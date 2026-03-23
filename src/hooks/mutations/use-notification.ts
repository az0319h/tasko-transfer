import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from "@/api/notification";
import { toast } from "sonner";

/**
 * 알림 읽음 처리 뮤테이션 훅
 */
export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => markNotificationAsRead(notificationId),
    onSuccess: () => {
      // 알림 목록 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      // 읽지 않은 알림 수 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "알림 읽음 처리에 실패했습니다.");
    },
  });
}

/**
 * 전체 알림 읽음 처리 뮤테이션 훅
 */
export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => markAllNotificationsAsRead(),
    onSuccess: (count) => {
      // 알림 목록 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      // 읽지 않은 알림 수 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
      toast.success(`${count}개의 알림을 읽음 처리했습니다.`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "전체 알림 읽음 처리에 실패했습니다.");
    },
  });
}

/**
 * 알림 삭제 뮤테이션 훅
 */
export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => deleteNotification(notificationId),
    onSuccess: () => {
      // 알림 목록 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      // 읽지 않은 알림 수 쿼리 무효화 및 즉시 refetch
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
      // 즉시 refetch하여 사이드바 배지가 바로 업데이트되도록 함
      queryClient.refetchQueries({ 
        queryKey: ["notifications", "unread-count"],
        type: 'active'
      });
      toast.success("알림이 삭제되었습니다.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "알림 삭제에 실패했습니다.");
    },
  });
}
