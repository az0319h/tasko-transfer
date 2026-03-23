/**
 * invite-user
 *
 * ## 개요
 * 관리자(admin)가 이메일 주소로 새 사용자를 초대합니다.
 * Supabase Auth의 inviteUserByEmail을 호출하고, profiles 테이블에 기본 레코드를 생성합니다.
 *
 * ## 호출 방식
 * - HTTP POST: 관리자 대시보드 등에서 직접 호출
 *
 * ## 권한
 * - profiles.role === "admin" 만 호출 가능
 *
 * ## 필수 환경 변수
 * - SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 * - VITE_FRONTEND_URL 또는 SITE_URL: 초대 후 리다이렉트 URL (미설정 시 localhost:5173)
 *
 * ## 요청 (Request)
 * - Body: { email: string, redirectTo?: string }
 *
 * ## 응답 (Response)
 * - 200: { success: true, message }
 * - 400: 이메일 누락 또는 초대 실패
 * - 401: 인증 없음 / 403: 관리자 아님
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
    // --- 인증 및 권한 검사 (admin만 허용) ---
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

    // Create Supabase client with user's JWT
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

    // Check if user is admin
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || profile?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "관리자 권한이 필요합니다." }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // --- 요청 검증 ---
    const { email, redirectTo } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "이메일 주소가 필요합니다." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // --- 초대 이메일 발송 (Service Role Key로 admin API 호출) ---
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    // Invite user by email
    const {
      data: inviteData,
      error: inviteError,
    } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: redirectTo || `${Deno.env.get("VITE_FRONTEND_URL") || Deno.env.get("SITE_URL") || "http://localhost:5173"}/profile/setup`,
    });

    if (inviteError) {
      return new Response(
        JSON.stringify({ error: inviteError.message || "초대 이메일 발송에 실패했습니다." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // --- profiles 레코드 생성 (초대된 사용자 기본 프로필) ---
    if (inviteData?.user) {
      const profileData = {
        id: inviteData.user.id,
        email: inviteData.user.email!,
        profile_completed: false,
        is_active: true,
        role: "member",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error: profileCreateError } = await supabaseAdmin
        .from("profiles")
        .insert(profileData);

      // Profile might already exist, so ignore duplicate key errors
      if (profileCreateError && !profileCreateError.message.includes("duplicate")) {
        console.error("Profile creation error:", profileCreateError);
        // Don't fail the request if profile creation fails
        // The profile will be created when user signs up
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "초대 이메일이 전송되었습니다.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error.message || "서버 오류가 발생했습니다.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});


