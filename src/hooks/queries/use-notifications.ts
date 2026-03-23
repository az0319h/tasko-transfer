import { useQuery } from "@tanstack/react-query";
import { getNotifications, getUnreadNotificationCount, type GetNotificationsOptions, type NotificationWithTask } from "@/api/notification";

/**
 * 알림 목록 조회 훅
 * @param options 페이지네이션 및 필터 옵션
 */
export function useNotifications(options: GetNotificationsOptions = {}) {
  return useQuery<NotificationWithTask[]>({
    queryKey: ["notifications", "list", options],
    queryFn: () => getNotifications(options),
    staleTime: 10 * 1000, // 10초 캐시
  });
}

/**
 * 읽지 않은 알림 수 조회 훅
 * 대시보드 메시지 count 패턴을 따라 구현
 * Realtime 이벤트에서 invalidateQueries + refetchQueries를 호출하여 즉시 업데이트
 */
export function useUnreadNotificationCount() {
  return useQuery<number>({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => getUnreadNotificationCount(),
    staleTime: 0, // 즉시 stale 처리하여 Realtime 이벤트 시 즉시 refetch되도록 함
    refetchOnMount: true, // 마운트 시 refetch
    refetchOnWindowFocus: true, // 창 포커스 시 refetch
    refetchOnReconnect: true, // 네트워크 재연결 시 refetch
    // gcTime을 짧게 설정하여 메모리 효율성 향상 (기본값 5분)
    gcTime: 5 * 60 * 1000,
  });
}
