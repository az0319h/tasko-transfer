import { setupProfileWithPassword } from "@/api/profile-setup";
import type { UseMutationCallback } from "@/types/common";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Database, Tables } from "@/database.type";

type Profile = Tables<"profiles">;

interface ProfileSetupData {
  password: string;
  full_name: string;
  position: string;
  phone: string;
}

export function useSetupProfileWithPassword(
  callbacks?: UseMutationCallback<Profile, ProfileSetupData>,
) {
  const queryClient = useQueryClient();

  return useMutation<Profile, Error, ProfileSetupData>({
    mutationFn: setupProfileWithPassword,
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      callbacks?.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      callbacks?.onError?.(error, variables, context);
    },
  });
}


