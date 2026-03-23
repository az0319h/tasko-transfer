import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import supabase from "@/lib/supabase";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type { Database } from "@/database.type";

type MessageRow = Database["public"]["Tables"]["messages"]["Row"];

/** Supabase Realtime 채널 제한: 연결당 100개, 초당 100 조인 */
const MAX_SUBSCRIPTIONS = 20;

/**
 * 대시보드용 메시지 실시간 구독 훅
 * 현재 페이지 Task의 메시지 변경 사항을 구독하여 대시보드의 읽지 않은 메시지 수를 실시간으로 업데이트합니다.
 * Supabase Realtime 제한으로 인해 최대 MAX_SUBSCRIPTIONS개 Task만 구독합니다.
 *
 * @param taskIds 구독할 Task ID 배열 (현재 페이지 Task 권장)
 * @param enabled 구독 활성화 여부
 */
export function useRealtimeDashboardMessages(
  taskIds: string[],
  enabled: boolean = true
) {
  const queryClient = useQueryClient();
  const channelsRef = useRef<Map<string, RealtimeChannel>>(new Map());
  const retryTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const retryCountsRef = useRef<Map<string, number>>(new Map());

  const limitedTaskIds = taskIds.slice(0, MAX_SUBSCRIPTIONS);

  if (import.meta.env.DEV && taskIds.length > MAX_SUBSCRIPTIONS) {
    console.warn(
      `[Realtime Dashboard] taskIds(${taskIds.length}) exceeded MAX_SUBSCRIPTIONS(${MAX_SUBSCRIPTIONS}). 일부 Task는 실시간 구독에서 제외됩니다.`
    );
  }

  useEffect(() => {
    if (!enabled || limitedTaskIds.length === 0) {
      // 구독 비활성화 또는 Task ID가 없으면 모든 채널 제거
      channelsRef.current.forEach((channel, taskId) => {
        supabase.removeChannel(channel);
        if (retryTimeoutsRef.current.has(taskId)) {
          clearTimeout(retryTimeoutsRef.current.get(taskId)!);
          retryTimeoutsRef.current.delete(taskId);
        }
      });
      channelsRef.current.clear();
      retryCountsRef.current.clear();
      return;
    }

    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000; // 2초

    // 각 Task ID마다 구독 설정
    const setupSubscription = (taskId: string) => {
      // 기존 채널이 있으면 제거
      if (channelsRef.current.has(taskId)) {
        const existingChannel = channelsRef.current.get(taskId);
        if (existingChannel) {
          supabase.removeChannel(existingChannel);
        }
        channelsRef.current.delete(taskId);
      }

      // 이전 재시도 타이머 정리
      if (retryTimeoutsRef.current.has(taskId)) {
        clearTimeout(retryTimeoutsRef.current.get(taskId)!);
        retryTimeoutsRef.current.delete(taskId);
      }

      const channelName = `dashboard-messages:${taskId}`;
      const filter = `task_id=eq.${taskId}`;

      // Realtime 채널 생성 (Task 상세 페이지와 동일한 패턴)
      const channel = supabase
        .channel(channelName, {
          config: {
            broadcast: { self: true }, // Task 상세 페이지와 동일하게 설정
          },
        })
        .on(
          "postgres_changes",
          {
            event: "*", // INSERT, UPDATE, DELETE 모두 구독
            schema: "public",
            table: "messages",
            filter: filter,
          },
          (payload: RealtimePostgresChangesPayload<MessageRow>) => {
            // 메시지 변경 시 대시보드 쿼리 무효화 및 즉시 refetch
            queryClient.invalidateQueries({ queryKey: ["tasks", "member"] });
            queryClient.invalidateQueries({ queryKey: ["tasks", "admin"] });
            queryClient.invalidateQueries({ queryKey: ["tasks", "reference"] });
            // 즉시 refetch하여 필터 변경 시에도 실시간 업데이트가 반영되도록 함
            queryClient.refetchQueries({ queryKey: ["tasks", "member"] });
            queryClient.refetchQueries({ queryKey: ["tasks", "admin"] });
            queryClient.refetchQueries({ queryKey: ["tasks", "reference"] });
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            retryCountsRef.current.set(taskId, 0); // 성공 시 재시도 카운터 리셋
          } else if (status === "CHANNEL_ERROR") {
            console.error(`[Realtime Dashboard] ❌ Channel error for task ${taskId}`, {
              error: "CHANNEL_ERROR",
              willRetry: (retryCountsRef.current.get(taskId) || 0) < 3,
            });
            handleSubscriptionFailure(taskId);
          } else if (status === "TIMED_OUT") {
            console.error(`[Realtime Dashboard] ⏱️ Subscription timed out for task ${taskId}`, {
              error: "TIMED_OUT",
              willRetry: (retryCountsRef.current.get(taskId) || 0) < 3,
            });
            handleSubscriptionFailure(taskId);
          } else if (status === "CLOSED") {
            console.warn(`[Realtime Dashboard] ⚠️ Channel closed for task ${taskId}`, {
              note: "This may be normal if component is unmounting",
            });
            // CLOSED는 정상적인 종료일 수 있으므로 재시도하지 않음
          } else if (status === "SUBSCRIBE_ERROR") {
            console.error(`[Realtime Dashboard] ❌ Subscribe error for task ${taskId}`, {
              error: "SUBSCRIBE_ERROR",
              willRetry: (retryCountsRef.current.get(taskId) || 0) < 3,
            });
            handleSubscriptionFailure(taskId);
          } else {
            console.warn(`[Realtime Dashboard] ⚠️ Unknown subscription status for task ${taskId}:`, status);
          }
        });

      channelsRef.current.set(taskId, channel);
    };

    const handleSubscriptionFailure = (taskId: string) => {
      const retryCount = retryCountsRef.current.get(taskId) || 0;
      
      if (retryCount < MAX_RETRIES) {
        const newRetryCount = retryCount + 1;
        retryCountsRef.current.set(taskId, newRetryCount);
        const delay = RETRY_DELAY * newRetryCount;
        
        const timeout = setTimeout(() => {
          setupSubscription(taskId);
        }, delay); // 지수 백오프
        
        retryTimeoutsRef.current.set(taskId, timeout);
      } else {
        console.error(
          `[Realtime Dashboard] ❌ Failed to subscribe after ${MAX_RETRIES} attempts for task ${taskId}. Please refresh the page.`,
          {
            taskId,
            finalRetryCount: retryCount,
            maxRetries: MAX_RETRIES,
          }
        );
      }
    };

    // 현재 Task ID 목록에 대해 구독 설정
    const currentTaskIdSet = new Set(limitedTaskIds);
    const existingTaskIdSet = new Set(channelsRef.current.keys());
    
    // 새로운 Task ID에 대해 구독 설정
    currentTaskIdSet.forEach((taskId) => {
      if (!channelsRef.current.has(taskId)) {
        setupSubscription(taskId);
      }
    });

    // 제거된 Task ID에 대한 채널 정리
    channelsRef.current.forEach((channel, existingTaskId) => {
      if (!currentTaskIdSet.has(existingTaskId)) {
        supabase.removeChannel(channel);
        channelsRef.current.delete(existingTaskId);
        if (retryTimeoutsRef.current.has(existingTaskId)) {
          clearTimeout(retryTimeoutsRef.current.get(existingTaskId)!);
          retryTimeoutsRef.current.delete(existingTaskId);
        }
        retryCountsRef.current.delete(existingTaskId);
      }
    });

    // 정리 함수
    return () => {
      channelsRef.current.forEach((channel, taskId) => {
        supabase.removeChannel(channel);
        if (retryTimeoutsRef.current.has(taskId)) {
          clearTimeout(retryTimeoutsRef.current.get(taskId)!);
        }
      });
      channelsRef.current.clear();
      retryTimeoutsRef.current.clear();
      retryCountsRef.current.clear();
    };
  }, [limitedTaskIds.join(","), enabled, queryClient]);
}
