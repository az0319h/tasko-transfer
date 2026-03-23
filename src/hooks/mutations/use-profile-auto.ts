import { createProfileAuto } from "@/api/profile";
import type { UseMutationCallback } from "@/types/common";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Database, Tables } from "@/database.type";

type Profile = Tables<"profiles">;

/**
 * 회원가입 시 프로필 자동 생성용 hook
 */
export function useCreateProfileAuto(
  callbacks?: UseMutationCallback<Profile, void>,
) {
  const queryClient = useQueryClient();

  return useMutation<Profile, Error, void>({
    mutationFn: createProfileAuto,
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      callbacks?.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      callbacks?.onError?.(error, variables, context);
    },
  });
}


