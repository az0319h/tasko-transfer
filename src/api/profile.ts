import supabase from "@/lib/supabase";
import type { Database, Tables, TablesInsert, TablesUpdate } from "@/database.type";

type Profile = Tables<"profiles">;
type ProfileInsert = TablesInsert<"profiles">;
type ProfileUpdate = TablesUpdate<"profiles">;

/**
 * 현재 로그인한 사용자의 프로필 조회
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("인증되지 않은 사용자입니다.");
  }

  // maybeSingle()을 사용하여 프로필이 없어도 에러를 던지지 않음
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    // PGRST116은 프로필이 없는 경우 (정상)
    if (error.code === "PGRST116") {
      return null;
    }
    // 다른 에러는 던짐
    throw error;
  }

  return data;
}

/**
 * 특정 사용자 프로필 조회 (관리자용)
 */
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw error;
  }

  return data;
}

/**
 * 프로필 생성 (회원가입 시 자동 생성용)
 * auth.users.email을 사용하며, profile_completed는 false로 설정
 */
export async function createProfileAuto(): Promise<Profile> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("인증되지 않은 사용자입니다.");

  // 프로필 자동 생성 (email은 auth.users.email 사용, profile_completed = false)
  const profileData: ProfileInsert = {
    id: user.id,
    email: user.email!,
    profile_completed: false,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("profiles")
    .insert(profileData)
    .select()
    .single();

  if (error) throw error;

  return data;
}

/**
 * 프로필 생성 (프로필 설정 완료용)
 * 사용자가 프로필 설정 페이지에서 정보를 입력한 후 호출
 */
export async function createProfile(profile: Omit<ProfileInsert, "id" | "email">): Promise<Profile> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("인증되지 않은 사용자입니다.");

  // 프로필 완성도 설정 (email은 auth.users.email 사용)
  const profileData: ProfileInsert = {
    ...profile,
    id: user.id,
    email: user.email!,
    profile_completed: true,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("profiles")
    .insert(profileData)
    .select()
    .single();

  if (error) throw error;

  return data;
}

/**
 * 프로필 수정
 * email은 수정할 수 없으며, auth.users.email과 항상 동일해야 함
 */
export async function updateProfile(updates: Omit<ProfileUpdate, "email" | "id">): Promise<Profile> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("인증되지 않은 사용자입니다.");

  const updateData: ProfileUpdate = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("profiles")
    .update(updateData)
    .eq("id", user.id)
    .select()
    .single();

  if (error) throw error;

  return data;
}

