import { signInWithPassword } from "@/api/auth";
import type { UseMutationCallback } from "@/types/common";
import { useMutation } from "@tanstack/react-query";
import type { AuthError } from "@supabase/supabase-js";

type SignInVariables = { email: string; password: string };
type SignInData = Awaited<ReturnType<typeof signInWithPassword>>;

export function useSignInWithPassword(
  callbacks?: UseMutationCallback<SignInData, SignInVariables, unknown, AuthError>,
) {
  return useMutation<SignInData, AuthError, SignInVariables, unknown>({
    mutationFn: signInWithPassword,

    onSuccess: (data, variables, context) => {
      callbacks?.onSuccess?.(data, variables, context);
    },

    onError: (error, variables, context) => {
      callbacks?.onError?.(error, variables, context);
    },
  });
}
