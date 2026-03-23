export type Theme = "light" | "dark" | "system";

export type UseMutationCallback<
  TData = unknown,
  TVariables = unknown,
  TContext = unknown,
  TError = Error,
> = {
  onMutate?: (variables: TVariables) => Promise<TContext | void> | (TContext | void);

  onSuccess?: (data: TData, variables: TVariables, context: TContext | undefined) => void;

  onError?: (error: TError, variables: TVariables, context: TContext | undefined) => void;

  onSettled?: (
    data: TData | undefined,
    error: TError | null,
    variables: TVariables,
    context: TContext | undefined,
  ) => void;
};
