/**
 * check-due-date-exceeded
 *
 * ## 개요
 * 지시자(assigner)가 "일정 시작일이 마감일을 초과했는지" 확인합니다.
 * 담당자 일정 자동 배정 시, 가능한 첫 일정이 마감일보다 늦으면 exceeded=true 를 반환합니다.
 *
 * ## 호출 방식
 * - HTTP POST: 프론트엔드에서 직접 호출 (일정 선택 UI 등)
 *
 * ## 권한
 * - 해당 task의 assigner_id 만 호출 가능
 *
 * ## 필수 환경 변수
 * - SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 *   (Service Role: RLS 우회로 task_schedules 조회, 지시자는 RLS 정책상 일정 조회 불가)
 *
 * ## 요청 (Request)
 * - Body: { taskId: string, dueDate: string } (dueDate: YYYY-MM-DD)
 *
 * ## 응답 (Response)
 * - 200: { exceeded: boolean, scheduleDate?, dueDate?, ... }
 *   exceeded=true: 일정 시작일 > 마감일
 *   reason="no_schedule": 담당자 일정이 30일 내 없음(배정 실패)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // --- CORS preflight ---
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // --- 인증 확인 ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "인증 토큰이 필요합니다." }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Create Supabase client with user's JWT (인증 확인용)
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      },
    );

    // Verify user is authenticated
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "인증되지 않은 사용자입니다." }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // --- 요청 검증 ---
    const { taskId, dueDate } = await req.json();

    if (!taskId || !dueDate) {
      console.error(`[check-due-date-exceeded] 필수 파라미터 누락: taskId=${taskId}, dueDate=${dueDate}`);
      return new Response(
        JSON.stringify({ error: "taskId와 dueDate가 필요합니다." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // --- 권한 확인 (지시자만 허용) ---
    const { data: task, error: taskError } = await supabaseClient
      .from("tasks")
      .select("id, assigner_id, assignee_id")
      .eq("id", taskId)
      .single();

    if (taskError || !task) {
      console.error(`[check-due-date-exceeded] Task 조회 실패:`, taskError);
      return new Response(
        JSON.stringify({ error: `Task를 찾을 수 없습니다: ${taskError?.message}` }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 지시자(assigner)만 이 기능을 사용할 수 있도록 확인
    if (task.assigner_id !== user.id) {
      console.error(`[check-due-date-exceeded] 권한 없음: userId=${user.id}, assignerId=${task.assigner_id}`);
      return new Response(
        JSON.stringify({ error: "이 Task의 지시자만 마감일을 확인할 수 있습니다." }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // --- 일정 조회 (재시도: DB 트리거 비동기로 일정 생성까지 대기) ---
    const supabaseServiceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // 일정 조회 (재시도 로직 포함)
    // DB 트리거가 비동기로 실행되므로 일정이 생성될 때까지 대기
    let schedule = null;
    const maxRetries = 10;
    const retryDelay = 200; // 200ms

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const { data, error } = await supabaseServiceClient
        .from("task_schedules")
        .select("*")
        .eq("task_id", taskId)
        .maybeSingle();

      if (error) {
        // 마지막 시도가 아니면 재시도
        if (attempt < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          continue;
        }
        // 마지막 시도에서도 에러면 에러 반환
        return new Response(
          JSON.stringify({ error: `일정 조회 실패: ${error.message}` }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // 일정을 찾으면 반복 종료
      if (data) {
        schedule = data;
        break;
      }

      // 일정이 없으면 재시도 (마지막 시도가 아니면)
      if (attempt < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }

    // 일정이 생성되지 않은 경우 (담당자 일정이 30일 내 모두 가득 찬 경우)
    if (!schedule) {
      return new Response(
        JSON.stringify({
          exceeded: false,
          reason: "no_schedule",
          message: "일정이 생성되지 않았습니다.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // --- 마감일 vs 일정 시작일 비교 (날짜만) ---
    const dueDateObj = new Date(dueDate);
    dueDateObj.setHours(0, 0, 0, 0);

    // schedule.start_time은 TIMESTAMPTZ이므로 Date 객체로 변환
    const scheduleStartDate = new Date(schedule.start_time);
    scheduleStartDate.setHours(0, 0, 0, 0);

    // 일정 시작일이 마감일보다 늦은 경우
    const exceeded = scheduleStartDate.getTime() > dueDateObj.getTime();

    return new Response(
      JSON.stringify({
        exceeded,
        scheduleDate: schedule.start_time,
        dueDate: dueDate,
        scheduleStartDate: scheduleStartDate.toISOString(),
        dueDateObj: dueDateObj.toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Edge Function 에러:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "알 수 없는 오류가 발생했습니다.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
