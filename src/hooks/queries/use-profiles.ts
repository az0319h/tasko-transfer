import { useQuery } from "@tanstack/react-query";
import supabase from "@/lib/supabase";
import type { Tables } from "@/database.type";

export type Profile = Tables<"profiles">;

/**
 * 프로필 목록 조회 훅
 * 프로필 완료된 사용자만 조회
 */
export function useProfiles() {
  return useQuery<Profile[]>({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("profile_completed", true)
        .eq("is_active", true)
        .order("full_name", { ascending: true });

      if (error) {
        throw new Error(`프로필 목록 조회 실패: ${error.message}`);
      }

      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5분간 캐시
  });
}

