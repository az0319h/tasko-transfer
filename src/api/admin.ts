import supabase from "@/lib/supabase";
import type { Database, Tables } from "@/database.type";

type Profile = Tables<"profiles">;

/**
 * 관리자 권한 확인
 */
export async function checkAdminPermission(): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Admin permission check error:", error);
    return false;
  }

  return data?.role === "admin";
}

/**
 * 모든 사용자 목록 조회 (관리자 전용)
 */
export async function getUsers(): Promise<Profile[]> {
  // 관리자 권한 확인
  const isAdmin = await checkAdminPermission();
  if (!isAdmin) {
    throw new Error("관리자 권한이 필요합니다.");
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

/**
 * 사용자 비활성화 (관리자 전용)
 */
export async function deactivateUser(userId: string): Promise<void> {
  // 관리자 권한 확인
  const isAdmin = await checkAdminPermission();
  if (!isAdmin) {
    throw new Error("관리자 권한이 필요합니다.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) throw error;
}

/**
 * 사용자 상태 토글 (활성/비활성) (관리자 전용)
 */
export async function toggleUserStatus(userId: string, isActive: boolean): Promise<Profile> {
  // 관리자 권한 확인
  const isAdmin = await checkAdminPermission();
  if (!isAdmin) {
    throw new Error("관리자 권한이 필요합니다.");
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select()
    .single();

  if (error) throw error;

  return data;
}

/**
 * 사용자 초대 이메일 발송 (관리자 전용)
 * Edge Function을 통해 Supabase Admin API 호출
 */
export async function inviteUser(email: string): Promise<void> {
  // 관리자 권한 확인
  const isAdmin = await checkAdminPermission();
  if (!isAdmin) {
    throw new Error("관리자 권한이 필요합니다.");
  }

  // Edge Function 호출
  const { data, error } = await supabase.functions.invoke("invite-user", {
    body: {
      email,
      redirectTo: `${import.meta.env.VITE_FRONTEND_URL}/profile/setup`,
    },
  });

  if (error) {
    throw new Error(error.message || "초대 이메일 발송에 실패했습니다.");
  }

  if (data?.error) {
    throw new Error(data.error);
  }
}
