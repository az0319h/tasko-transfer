import { signOut } from "@/api/auth";
import type { UseMutationCallback } from "@/types/common";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useSignOut(callbacks?: UseMutationCallback<void, void>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      // 로그아웃 시 모든 React Query 캐시 삭제
      // 다른 유저로 로그인할 때 이전 유저의 데이터가 남아있지 않도록
      queryClient.clear();
      
      callbacks?.onSuccess?.(undefined, undefined, undefined);
    },
    onError: (error) => {
      callbacks?.onError?.(error, undefined, undefined);
    },
  });
}
