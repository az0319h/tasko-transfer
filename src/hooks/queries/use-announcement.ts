import { useQuery } from "@tanstack/react-query";
import { getAnnouncementById } from "@/api/announcement";
import type { AnnouncementWithDetails } from "@/api/announcement";

/**
 * 단일 공지사항 상세 조회 훅 (수정 페이지용)
 */
export function useAnnouncement(id: string | undefined) {
  return useQuery<AnnouncementWithDetails | null>({
    queryKey: ["announcements", "detail", id],
    queryFn: () => (id ? getAnnouncementById(id) : Promise.resolve(null)),
    enabled: !!id,
    staleTime: 30 * 1000, // 30초간 캐시
  });
}
