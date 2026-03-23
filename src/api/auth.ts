import supabase from "@/lib/supabase";

export async function signInWithPassword({ email, password }: { email: string; password: string }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  // 로그인 성공
  // 프로필 조회 및 is_active 체크는 member-only-layout에서 처리
  // 로그인 직후에는 세션이 완전히 설정되지 않을 수 있으므로 여기서는 조회하지 않음
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function signUp({ email, password }: { email: string; password: string }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) throw error;
  return data;
}
