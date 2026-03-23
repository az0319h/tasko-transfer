import { useState, useEffect, useRef, useCallback } from "react";
import supabase from "@/lib/supabase";
import { useCurrentProfile } from "@/hooks";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Chat Presence 훅
 * Supabase Realtime Broadcast를 사용하여 채팅 화면에 사용자가 존재함을 실시간으로 추적
 * @param taskId Task ID
 * @param enabled 활성화 여부
 */
export function useChatPresence(taskId: string | undefined, enabled: boolean = true) {
  const { data: currentProfile } = useCurrentProfile();
  const [isPresent, setIsPresent] = useState(false); // 현재 사용자의 Presence 상태
  const [activeUsers, setActiveUsers] = useState<Map<string, { userId: string; userName: string; lastSeen: number }>>(
    new Map()
  ); // userId -> { userId, userName, lastSeen }
  const channelRef = useRef<RealtimeChannel | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPresenceTimeRef = useRef<Map<string, number>>(new Map()); // userId -> timestamp
  const isPresentRef = useRef(false); // ref로 최신 상태 추적

  // Presence 상태 Broadcast
  const broadcastPresence = useCallback(() => {
    if (!taskId || !enabled || !currentProfile?.id || !channelRef.current) {
      return;
    }

    const payload = {
      userId: currentProfile.id,
      userName: currentProfile.full_name || currentProfile.email || "사용자",
      timestamp: Date.now(),
    };

    channelRef.current.send({
      type: "broadcast",
      event: "presence-update",
      payload,
    });

    // 마지막 Presence 시간 업데이트
    lastPresenceTimeRef.current.set(currentProfile.id, Date.now());
  }, [taskId, enabled, currentProfile]);

  // Presence 상태 해제 Broadcast
  const broadcastLeave = useCallback(() => {
    if (!taskId || !enabled || !currentProfile?.id || !channelRef.current) {
      return;
    }

    channelRef.current.send({
      type: "broadcast",
      event: "presence-leave",
      payload: {
        userId: currentProfile.id,
        timestamp: Date.now(),
      },
    });
  }, [taskId, enabled, currentProfile]);

  // Presence 활성화
  const activatePresence = useCallback(() => {
    if (!taskId || !enabled || !currentProfile?.id || isPresentRef.current) {
      return;
    }

    isPresentRef.current = true;
    setIsPresent(true);
    broadcastPresence();

    // Heartbeat 시작: 30초마다 Presence 상태 갱신
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    heartbeatIntervalRef.current = setInterval(() => {
      if (isPresentRef.current && channelRef.current) {
        broadcastPresence();
      }
    }, 30000); // 30초

  }, [taskId, enabled, currentProfile, broadcastPresence]);

  // Presence 비활성화
  const deactivatePresence = useCallback(() => {
    if (!isPresentRef.current) {
      return;
    }

    isPresentRef.current = false;
    setIsPresent(false);
    broadcastLeave();

    // Heartbeat 중지
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, [broadcastLeave, taskId]);

  useEffect(() => {
    if (!taskId || !enabled) {
      return;
    }

    let isMounted = true;

    // Realtime 채널 생성 (Broadcast용)
    const channel = supabase
      .channel(`presence:${taskId}`, {
        config: {
          broadcast: { self: true },
        },
      })
      .on("broadcast", { event: "presence-update" }, (payload) => {
        const { userId, userName, timestamp } = payload.payload;

        // 다른 사용자의 Presence 업데이트
        if (userId !== currentProfile?.id) {
          setActiveUsers((prev) => {
            const next = new Map(prev);
            next.set(userId, {
              userId,
              userName: userName || "사용자",
              lastSeen: timestamp || Date.now(),
            });
            return next;
          });
          lastPresenceTimeRef.current.set(userId, timestamp || Date.now());
        }
      })
      .on("broadcast", { event: "presence-leave" }, (payload) => {
        const { userId } = payload.payload;

        // 다른 사용자의 Presence 해제
        if (userId !== currentProfile?.id) {
          setActiveUsers((prev) => {
            const next = new Map(prev);
            next.delete(userId);
            return next;
          });
          lastPresenceTimeRef.current.delete(userId);
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && isMounted) {
          // 구독 성공 시 즉시 Presence 활성화
          isPresentRef.current = true;
          setIsPresent(true);
          broadcastPresence();

          // Heartbeat 시작: 30초마다 Presence 상태 갱신
          if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
          }
          heartbeatIntervalRef.current = setInterval(() => {
            if (isMounted && isPresentRef.current && channelRef.current) {
              broadcastPresence();
            }
          }, 30000); // 30초
        }
      });

    channelRef.current = channel;

    // 페이지 visibility change 감지 (탭 전환 등)
    const handleVisibilityChange = () => {
      if (!isMounted) return;

      if (document.hidden) {
        // 페이지가 비활성화되면 Presence 해제
        isPresentRef.current = false;
        setIsPresent(false);
        broadcastLeave();

        // Heartbeat 중지
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }
      } else {
        // 페이지가 다시 활성화되면 Presence 재활성화
        isPresentRef.current = true;
        setIsPresent(true);
        broadcastPresence();

        // Heartbeat 재시작
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
        heartbeatIntervalRef.current = setInterval(() => {
          if (isMounted && isPresentRef.current && channelRef.current) {
            broadcastPresence();
          }
        }, 30000);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // 페이지 unload 감지 (페이지 닫기 등)
    const handleBeforeUnload = () => {
      isPresentRef.current = false;
      setIsPresent(false);
      broadcastLeave();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    // 클린업
    return () => {
      isMounted = false;

      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);

      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }

      if (channelRef.current) {
        // Presence 해제 후 채널 제거
        isPresentRef.current = false;
        setIsPresent(false);
        broadcastLeave();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      isPresentRef.current = false;
      setIsPresent(false);
      setActiveUsers(new Map());
      lastPresenceTimeRef.current.clear();
    };
  }, [taskId, enabled, currentProfile, broadcastPresence, broadcastLeave]);

  // 활성 사용자 목록 정리 (60초 이상 업데이트되지 않은 사용자 제거)
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const timeout = 60000; // 60초

      setActiveUsers((prev) => {
        const next = new Map(prev);
        let hasChanges = false;

        prev.forEach((user, userId) => {
          const lastSeen = lastPresenceTimeRef.current.get(userId) || user.lastSeen;
          if (now - lastSeen > timeout) {
            next.delete(userId);
            lastPresenceTimeRef.current.delete(userId);
            hasChanges = true;
          }
        });

        return hasChanges ? next : prev;
      });
    }, 30000); // 30초마다 정리

    return () => clearInterval(cleanupInterval);
  }, []);

  return {
    isPresent, // 현재 사용자가 Presence 상태인지
    activeUsers: Array.from(activeUsers.values()), // 현재 채팅 화면에 있는 사용자 목록
    activatePresence, // 수동으로 Presence 활성화 (필요 시)
    deactivatePresence, // 수동으로 Presence 비활성화 (필요 시)
  };
}

