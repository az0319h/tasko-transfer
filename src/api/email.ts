import supabase from "@/lib/supabase";

interface ChangeEmailData {
  currentPassword: string;
  newEmail: string;
}

/**
 * 이메일 변경 (기존 비밀번호 확인 후 새 이메일로 변경 요청)
 */
export async function changeEmail(data: ChangeEmailData): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("인증되지 않은 사용자입니다.");

  if (!user.email) {
    throw new Error("현재 이메일 주소를 찾을 수 없습니다.");
  }

  // 새 이메일이 현재 이메일과 같은지 확인
  if (user.email.toLowerCase() === data.newEmail.toLowerCase()) {
    throw new Error("새 이메일은 현재 이메일과 달라야 합니다.");
  }

  // 기존 비밀번호 확인을 위해 로그인 시도
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: data.currentPassword,
  });

  if (signInError) {
    throw new Error("기존 비밀번호가 올바르지 않습니다.");
  }

  // 새 이메일로 업데이트 요청 (확인 이메일이 발송됨)
  const { error: updateError } = await supabase.auth.updateUser(
    {
      email: data.newEmail,
    },
    {
      emailRedirectTo: `${import.meta.env.VITE_FRONTEND_URL || "http://localhost:5173"}`,
    },
  );

  if (updateError) throw updateError;
}
