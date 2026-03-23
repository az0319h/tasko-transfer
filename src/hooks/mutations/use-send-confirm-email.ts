import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sendConfirmEmail } from "@/api/confirm-email";
import { toast } from "sonner";

export function useSendConfirmEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      taskId: string;
      subject: string;
      htmlBody: string;
      attachment?: { url: string; fileName: string };
    }) => sendConfirmEmail(params),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks", "detail", variables.taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-lists"] });
      toast.success(data.message ?? "컨펌 이메일 발송 요청이 접수되었습니다.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "컨펌 이메일 발송에 실패했습니다.");
    },
  });
}
