import { useQuery } from "@tanstack/react-query";
import { getAnnouncements } from "@/api/announcement";
import type { AnnouncementWithDetails } from "@/api/announcement";

/**
 * 공지사항 목록 조회 훅 (관리자용)
 * 모든 데이터를 한 번에 가져옴 (클라이언트 사이드 필터링/페이지네이션용)
 */
export function useAdminAnnouncements() {
  return useQuery<AnnouncementWithDetails[]>({
    queryKey: ["announcements", "admin"],
    queryFn: () => getAnnouncements(),
    staleTime: 30 * 1000, // 30초간 캐시
    enabled: true, // 관리자 권한은 API 함수 내에서 확인
  });
}
