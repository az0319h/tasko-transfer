import { resetPassword, updatePassword, changePassword } from "@/api/password";
import type { UseMutationCallback } from "@/types/common";
import { useMutation } from "@tanstack/react-query";

interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

export function useResetPassword(
  callbacks?: UseMutationCallback<void, string>,
) {
  return useMutation<void, Error, string>({
    mutationFn: resetPassword,
    onSuccess: (data, variables, context) => {
      callbacks?.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      callbacks?.onError?.(error, variables, context);
    },
  });
}

export function useUpdatePassword(
  callbacks?: UseMutationCallback<void, string>,
) {
  return useMutation<void, Error, string>({
    mutationFn: updatePassword,
    onSuccess: (data, variables, context) => {
      callbacks?.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      callbacks?.onError?.(error, variables, context);
    },
  });
}

export function useChangePassword(
  callbacks?: UseMutationCallback<void, ChangePasswordData>,
) {
  return useMutation<void, Error, ChangePasswordData>({
    mutationFn: changePassword,
    onSuccess: (data, variables, context) => {
      callbacks?.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      callbacks?.onError?.(error, variables, context);
    },
  });
}


