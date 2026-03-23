import { useQuery } from "@tanstack/react-query";
import { getMessageLogsByTaskId } from "@/api/message";
import type { MessageLogWithSystemMessage } from "@/api/message";

/**
 * Task의 메시지 로그(그룹) 목록 조회 훅
 */
export function useMessageLogs(taskId: string | undefined) {
  return useQuery<MessageLogWithSystemMessage[]>({
    queryKey: ["message_logs", taskId],
    queryFn: () => (taskId ? getMessageLogsByTaskId(taskId) : Promise.resolve([])),
    enabled: !!taskId,
    staleTime: 30 * 1000, // 로그는 메시지보다 덜 자주 갱신되어도 됨
  });
}
