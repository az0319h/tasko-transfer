import { useQuery } from "@tanstack/react-query";
import { getChatLogsByTaskId } from "@/api/message";
import type { ChatLogWithItems } from "@/api/message";

/**
 * Task의 채팅 로그(그룹) 목록 조회 훅 (새 시스템)
 */
export function useChatLogs(taskId: string | undefined) {
  return useQuery<ChatLogWithItems[]>({
    queryKey: ["chat_logs", taskId],
    queryFn: () => (taskId ? getChatLogsByTaskId(taskId) : Promise.resolve([])),
    enabled: !!taskId,
    staleTime: 30 * 1000, // 로그는 메시지보다 덜 자주 갱신되어도 됨
  });
}
