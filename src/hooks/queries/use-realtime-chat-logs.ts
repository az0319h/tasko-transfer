import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import supabase from "@/lib/supabase";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type { Database } from "@/database.type";

type TaskChatLogRow = Database["public"]["Tables"]["task_chat_logs"]["Row"];

/**
 * Supabase Realtime으로 채팅 로그 실시간 구독 훅
 * @param taskId Task ID
 * @param enabled 구독 활성화 여부
 */
export function useRealtimeChatLogs(
  taskId: string | undefined,
  enabled: boolean = true
) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId || !enabled) {
      return;
    }

    // 이전 재시도 타이머 정리
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000; // 2초

    const setupSubscription = () => {
      // 기존 채널이 있으면 제거
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      // Realtime 채널 생성
      const channel = supabase
        .channel(`chat_logs:${taskId}`, {
          config: {
            broadcast: { self: true },
          },
        })
        // task_chat_logs 테이블 구독
        .on(
          "postgres_changes",
          {
            event: "INSERT", // 로그는 생성 후 수정/삭제 불가이므로 INSERT만
            schema: "public",
            table: "task_chat_logs",
            filter: `task_id=eq.${taskId}`,
          },
          (payload: RealtimePostgresChangesPayload<TaskChatLogRow>) => {
            // 쿼리 무효화하여 새 로그 즉시 표시
            // 로그 생성 시 아이템도 함께 생성되므로 task_chat_logs만 구독해도 충분
            queryClient.invalidateQueries({ queryKey: ["chat_logs", taskId] });
          }
        )
        .subscribe((status) => {
          setSubscriptionStatus(status);

          if (status === "SUBSCRIBED") {
            retryCountRef.current = 0; // 성공 시 재시도 카운터 리셋
          } else if (status === "CHANNEL_ERROR") {
            console.error(`[Realtime] ❌ Channel error for chat logs task ${taskId}`);
            handleSubscriptionFailure();
          } else if (status === "TIMED_OUT") {
            console.error(`[Realtime] ⏱️ Chat logs subscription timed out for task ${taskId}`);
            handleSubscriptionFailure();
          } else if (status === "CLOSED") {
            console.warn(`[Realtime] ⚠️ Chat logs channel closed for task ${taskId}`);
            // CLOSED는 정상적인 종료일 수 있으므로 재시도하지 않음
          } else if (status === "SUBSCRIBE_ERROR") {
            console.error(`[Realtime] ❌ Subscribe error for chat logs task ${taskId}`);
            handleSubscriptionFailure();
          }
        });

      channelRef.current = channel;
    };

    const handleSubscriptionFailure = () => {
      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current += 1;
        retryTimeoutRef.current = setTimeout(() => {
          setupSubscription();
        }, RETRY_DELAY * retryCountRef.current); // 지수 백오프
      } else {
        console.error(
          `[Realtime] ❌ Failed to subscribe to chat logs after ${MAX_RETRIES} attempts for task ${taskId}. Please refresh the page.`
        );
      }
    };

    // 초기 구독 설정
    setupSubscription();

    // 클린업: 구독 해제
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      retryCountRef.current = 0;
      setSubscriptionStatus(null);
    };
  }, [taskId, enabled, queryClient]);

  // 디버깅용: 구독 상태 반환 (선택사항)
  return { subscriptionStatus };
}
