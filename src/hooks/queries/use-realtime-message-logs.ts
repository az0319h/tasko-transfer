import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import supabase from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * 메시지 로그(그룹) 리얼타임 구독 훅
 */
export function useRealtimeMessageLogs(taskId: string | undefined) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!taskId) return;

    const setupSubscription = () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }

      const channel = supabase
        .channel(`message_logs:${taskId}`)
        .on(
          "postgres_changes",
          {
            event: "*", // INSERT, UPDATE 모두 구독
            schema: "public",
            table: "message_logs",
            filter: `task_id=eq.${taskId}`,
          },
          () => {
            // 로그에 변화가 생기면 쿼리 무효화
            queryClient.invalidateQueries({ queryKey: ["message_logs", taskId] });
          }
        )
        .subscribe();

      channelRef.current = channel;
    };

    setupSubscription();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [taskId, queryClient]);
}
