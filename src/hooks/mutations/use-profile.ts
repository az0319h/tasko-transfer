import { createProfile, createProfileAuto, updateProfile } from "@/api/profile";
import type { UseMutationCallback } from "@/types/common";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Database, Tables, TablesInsert, TablesUpdate } from "@/database.type";

type Profile = Tables<"profiles">;
type ProfileInsert = TablesInsert<"profiles">;
type ProfileUpdate = TablesUpdate<"profiles">;

type CreateProfileVariables = Omit<ProfileInsert, "id" | "email">;
type UpdateProfileVariables = Omit<ProfileUpdate, "email" | "id">;

export function useCreateProfile(
  callbacks?: UseMutationCallback<Profile, CreateProfileVariables>,
) {
  const queryClient = useQueryClient();

  return useMutation<Profile, Error, CreateProfileVariables>({
    mutationFn: createProfile,
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      callbacks?.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      callbacks?.onError?.(error, variables, context);
    },
  });
}

export function useUpdateProfile(
  callbacks?: UseMutationCallback<Profile, UpdateProfileVariables>,
) {
  const queryClient = useQueryClient();

  return useMutation<Profile, Error, UpdateProfileVariables>({
    mutationFn: updateProfile,
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      callbacks?.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      callbacks?.onError?.(error, variables, context);
    },
  });
}

