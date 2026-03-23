import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createAgent,
  updateAgent,
  deleteAgent,
} from "@/api/agent";
import type { Agent, CreateAgentInput, UpdateAgentInput } from "@/types/domain/agent";
import { toast } from "sonner";

/**
 * 에이전트 생성 뮤테이션 훅
 */
export function useCreateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateAgentInput) => createAgent(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      toast.success("에이전트가 생성되었습니다.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "에이전트 생성에 실패했습니다.");
    },
  });
}

/**
 * 에이전트 수정 뮤테이션 훅
 */
export function useUpdateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ agentId, data }: { agentId: string; data: UpdateAgentInput }) =>
      updateAgent(agentId, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      queryClient.invalidateQueries({ queryKey: ["agents", "detail", data.id] });
      toast.success("에이전트가 수정되었습니다.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "에이전트 수정에 실패했습니다.");
    },
  });
}

/**
 * 에이전트 삭제 뮤테이션 훅
 */
export function useDeleteAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (agentId: string) => deleteAgent(agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      toast.success("에이전트가 삭제되었습니다.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "에이전트 삭제에 실패했습니다.");
    },
  });
}
