import { useQuery } from "@tanstack/react-query";
import { getAgents, getAgentById } from "@/api/agent";
import type { Agent, AgentWithMedia } from "@/types/domain/agent";

/**
 * 에이전트 목록 조회 훅
 * 모든 관리자가 모든 에이전트를 조회할 수 있습니다.
 */
export function useAgents() {
  return useQuery<Agent[]>({
    queryKey: ["agents", "list"],
    queryFn: () => getAgents(),
    staleTime: 30 * 1000, // 30초간 캐시
  });
}

/**
 * 에이전트 상세 조회 훅
 * @param agentId 에이전트 ID
 */
export function useAgent(agentId: string | undefined) {
  return useQuery<AgentWithMedia>({
    queryKey: ["agents", "detail", agentId],
    queryFn: () => {
      if (!agentId) throw new Error("에이전트 ID가 필요합니다.");
      return getAgentById(agentId);
    },
    enabled: !!agentId,
    staleTime: 30 * 1000, // 30초간 캐시
  });
}
