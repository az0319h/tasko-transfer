import { useQuery } from "@tanstack/react-query";
import { getActiveAnnouncements } from "@/api/announcement";
import type { AnnouncementWithDetails } from "@/api/announcement";

/**
 * 활성 공지사항 조회 훅 (일반 사용자용)
 * - is_active = true
 * - expires_at이 NULL이거나 미래인 것만
 * - 사용자가 "다시 보지 않음"으로 표시한 것은 제외
 * - 최신순 정렬
 */
export function useAnnouncements() {
  return useQuery<AnnouncementWithDetails[]>({
    queryKey: ["announcements", "active"],
    queryFn: getActiveAnnouncements,
    staleTime: 30 * 1000, // 30초간 캐시
    refetchOnWindowFocus: true, // 창 포커스 시 재조회
  });
}
