import { getCurrentProfile } from "@/api/profile";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/store/session";

export function useCurrentProfile() {
  const session = useSession();

  return useQuery({
    queryKey: ["profile", "current"],
    queryFn: getCurrentProfile,
    enabled: !!session, // 세션이 있을 때만 조회
    retry: 1, // 실패 시 1번만 재시도 (기본값과 동일)
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000), // 지수 백오프
  });
}


