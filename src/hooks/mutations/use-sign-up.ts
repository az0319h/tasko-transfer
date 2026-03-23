import { signUp } from "@/api/auth";
import type { UseMutationCallback } from "@/types/common";
import { useMutation } from "@tanstack/react-query";
import type { AuthError } from "@supabase/supabase-js";

type SignUpVariables = { email: string; password: string };
type SignUpData = Awaited<ReturnType<typeof signUp>>;

export function useSignUp(
  callbacks?: UseMutationCallback<SignUpData, SignUpVariables, unknown, AuthError>,
) {
  return useMutation<SignUpData, AuthError, SignUpVariables, unknown>({
    mutationFn: signUp,

    onSuccess: (data, variables, context) => {
      callbacks?.onSuccess?.(data, variables, context);
    },

    onError: (error, variables, context) => {
      callbacks?.onError?.(error, variables, context);
    },
  });
}


