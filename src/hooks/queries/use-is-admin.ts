import { checkAdminPermission } from "@/api/admin";
import { useQuery } from "@tanstack/react-query";

export function useIsAdmin() {
  return useQuery({
    queryKey: ["admin", "isAdmin"],
    queryFn: checkAdminPermission,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5분간 캐시
  });
}


