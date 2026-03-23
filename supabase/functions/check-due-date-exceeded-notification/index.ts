/**
 * check-due-date-exceeded-notification
 *
 * ## 개요
 * 마감일이 지났고 아직 APPROVED가 아닌 Task에 대해 담당자에게 알림을 생성합니다.
 * Task당 1회만 알림 생성 (중복 방지).
 *
 * ## 호출 방식
 * - pg_cron 등 스케줄러에서 매일 호출 (또는 HTTP)
 *
 * ## 필수 환경 변수
 * - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * ## 응답 (Response)
 * - 200: { message, processed, notifications_created, errors? }
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

interface TaskWithDueDate {
  id: string;
  title: string;
  assignee_id: string | null;
  due_date: string;
  task_status: string;
}

Deno.serve(async (req: Request) => {
  try {
    // --- 환경 변수 및 Supabase 클라이언트 ---
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("[check-due-date-exceeded-notification] 환경 변수 누락");
      return new Response(
        JSON.stringify({ error: "환경 변수가 설정되지 않았습니다." }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // --- 마감일 초과 Task 조회 (due_date < 오늘, task_status != APPROVED) ---
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0]; // YYYY-MM-DD

    // 마감일이 지났고 APPROVED가 아닌 Task 조회 (담당자가 있는 Task만)
    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select("id, title, assignee_id, due_date, task_status")
      .not("assignee_id", "is", null)
      .not("due_date", "is", null)
      .neq("task_status", "APPROVED")
      .lt("due_date", todayStr)
      .order("due_date", { ascending: true });

    if (tasksError) {
      console.error("[check-due-date-exceeded-notification] Task 조회 실패:", tasksError);
      return new Response(
        JSON.stringify({ error: `Task 조회 실패: ${tasksError.message}` }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!tasks || tasks.length === 0) {
      return new Response(
        JSON.stringify({ message: "마감일이 초과된 Task가 없습니다.", processed: 0 }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    let processedCount = 0;
    let notificationCount = 0;
    const errors: string[] = [];

    // 각 Task에 대해 처리
    for (const task of tasks as TaskWithDueDate[]) {
      try {
        // 마감일 날짜 계산 (날짜만 비교)
        const dueDate = new Date(task.due_date);
        dueDate.setHours(0, 0, 0, 0);
        const dueDateStr = dueDate.toISOString().split("T")[0]; // YYYY-MM-DD

        // 초과 일수 계산 (오늘 - 마감일)
        const exceededDays = Math.ceil(
          (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        // --- 중복 알림 방지 (같은 Task에 대한 TASK_DUE_DATE_EXCEEDED 1회만) ---
        const { data: existingNotification, error: checkError } = await supabase
          .from("notifications")
          .select("id")
          .eq("task_id", task.id)
          .eq("notification_type", "TASK_DUE_DATE_EXCEEDED")
          .maybeSingle();

        if (checkError) {
          console.error(
            `[check-due-date-exceeded-notification] 중복 체크 실패 (Task ${task.id}):`,
            checkError
          );
          errors.push(`Task ${task.id}: 중복 체크 실패 - ${checkError.message}`);
          continue;
        }

        // 이미 알림이 있으면 스킵
        if (existingNotification) {
          continue;
        }

        // --- 알림 생성 (create_notification RPC) ---
        const title = "Task 마감일이 초과되었습니다";
        const message = `${task.title} Task의 마감일이 지났습니다. 아직 승인되지 않았습니다.`;

        const { data: notificationId, error: notificationError } = await supabase.rpc(
          "create_notification",
          {
            p_user_id: task.assignee_id,
            p_notification_type: "TASK_DUE_DATE_EXCEEDED",
            p_title: title,
            p_message: message,
            p_task_id: task.id,
            p_metadata: {
              exceeded_days: exceededDays,
              due_date: dueDateStr,
            },
          }
        );

        if (notificationError) {
          console.error(
            `[check-due-date-exceeded-notification] 알림 생성 실패 (Task ${task.id}):`,
            notificationError
          );
          errors.push(
            `Task ${task.id}: 알림 생성 실패 - ${notificationError.message}`
          );
          continue;
        }

        notificationCount++;
      } catch (error) {
        console.error(
          `[check-due-date-exceeded-notification] Task ${task.id} 처리 중 오류:`,
          error
        );
        errors.push(`Task ${task.id}: ${error.message || "알 수 없는 오류"}`);
      }

      processedCount++;
    }

    const result = {
      message: "마감일 초과 알림 체크 완료",
      processed: processedCount,
      notifications_created: notificationCount,
      errors: errors.length > 0 ? errors : undefined,
    };

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[check-due-date-exceeded-notification] Edge Function 에러:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "알 수 없는 오류가 발생했습니다.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
