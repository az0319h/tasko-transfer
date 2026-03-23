import { changeEmail } from "@/api/email";
import type { UseMutationCallback } from "@/types/common";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface ChangeEmailData {
  currentPassword: string;
  newEmail: string;
}

export function useChangeEmail(
  callbacks?: UseMutationCallback<void, ChangeEmailData>,
) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, ChangeEmailData>({
    mutationFn: changeEmail,
    onSuccess: (data, variables, context) => {
      // 프로필 쿼리 무효화하여 이메일 변경 후 프로필 정보 갱신
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      callbacks?.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      callbacks?.onError?.(error, variables, context);
    },
  });
}

