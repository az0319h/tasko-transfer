import supabase from "@/lib/supabase";

/**
 * 비밀번호 재설정 이메일 발송
 */
export async function resetPassword(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${import.meta.env.VITE_FRONTEND_URL}/reset-password`,
  });

  if (error) throw error;
}

/**
 * 새 비밀번호로 업데이트 (매직 링크로 접근한 경우)
 */
export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) throw error;
}

interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

/**
 * 비밀번호 변경 (기존 비밀번호 확인 후 새 비밀번호로 변경)
 */
export async function changePassword(data: ChangePasswordData): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("인증되지 않은 사용자입니다.");

  // 기존 비밀번호 확인을 위해 로그인 시도
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: data.currentPassword,
  });

  if (signInError) {
    throw new Error("기존 비밀번호가 올바르지 않습니다.");
  }

  // 새 비밀번호로 업데이트
  const { error: updateError } = await supabase.auth.updateUser({
    password: data.newPassword,
  });

  if (updateError) throw updateError;
}
