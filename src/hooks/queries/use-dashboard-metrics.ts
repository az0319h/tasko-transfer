import { useQuery } from "@tanstack/react-query";
import { getDashboardMetrics } from "@/api/dashboard-metrics";
import type { DashboardMetricsRole } from "@/api/dashboard-metrics";

/**
 * 대시보드 메트릭 조회 훅
 * @param role "admin" | "member" - Admin: 지시자(assigner) 기준, Member: 담당자(assignee) 기준
 */
export function useDashboardMetrics(role: DashboardMetricsRole) {
  return useQuery({
    queryKey: ["dashboard-metrics", role],
    queryFn: () => getDashboardMetrics(role),
    staleTime: 60 * 1000, // 1분
  });
}
