import supabase from "@/lib/supabase";
import type { Database, Tables, TablesInsert, TablesUpdate } from "@/database.type";

type Profile = Tables<"profiles">;
type ProfileInsert = TablesInsert<"profiles">;
type ProfileUpdate = TablesUpdate<"profiles">;

interface ProfileSetupData {
  password: string;
  full_name: string;
  position: string;
  phone: string;
}

/**
 * 프로필 설정 (비밀번호 설정 + 프로필 생성)
 * 초대로 들어온 사용자가 비밀번호를 설정하고 프로필을 완성하는 함수
 */
export async function setupProfileWithPassword(data: ProfileSetupData): Promise<Profile> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("인증되지 않은 사용자입니다.");

  // 1. 비밀번호 업데이트
  const { error: passwordError } = await supabase.auth.updateUser({
    password: data.password,
  });

  if (passwordError) throw passwordError;

  // 2. 프로필 생성 또는 업데이트
  const profileData: ProfileInsert = {
    id: user.id,
    email: user.email!,
    full_name: data.full_name,
    position: data.position,
    phone: data.phone,
    profile_completed: true,
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    is_active: true,
    role: "member",
  };

  // 기존 프로필 확인
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  let result;
  if (existingProfile) {
    // 기존 프로필 업데이트
    const updateData: ProfileUpdate = {
      full_name: data.full_name,
      position: data.position,
      phone: data.phone,
      profile_completed: true,
      updated_at: new Date().toISOString(),
    };
    result = await supabase.from("profiles").update(updateData).eq("id", user.id).select().single();
  } else {
    // 새 프로필 생성
    result = await supabase.from("profiles").insert(profileData).select().single();
  }

  if (result.error) throw result.error;

  return result.data;
}
