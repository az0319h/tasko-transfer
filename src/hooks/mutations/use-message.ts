import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createMessage,
  createFileMessage,
  createMessageWithFiles,
  markMessageAsRead,
  markTaskMessagesAsRead,
  deleteMessage,
  type MessageInsert,
  type MessageWithProfile,
} from "@/api/message";
import { toast } from "sonner";

/**
 * 메시지 생성 뮤테이션 훅 (optimistic update 적용)
 */
export function useCreateMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (message: MessageInsert) => createMessage(message),
    onMutate: async (newMessage) => {
      // 진행 중인 쿼리 취소
      await queryClient.cancelQueries({ queryKey: ["messages", newMessage.task_id] });

      // 이전 값 백업 (롤백용)
      const previousMessages = queryClient.getQueryData(["messages", newMessage.task_id]);

      // Optimistic update
      queryClient.setQueryData<MessageWithProfile[]>(["messages", newMessage.task_id], (old) => {
        if (!old) return old;
        const optimisticMessage: MessageWithProfile = {
          id: `temp-${Date.now()}`,
          ...newMessage,
          user_id: "", // 실제 user_id는 서버에서 설정됨
          created_at: new Date().toISOString(),
          read_by: [],
          sender: {
            id: "",
            full_name: null,
            email: "",
            avatar_url: null,
          },
        } as MessageWithProfile;
        return [...old, optimisticMessage];
      });

      return { previousMessages };
    },
    onError: (error, variables, context) => {
      // 에러 발생 시 롤백
      if (context?.previousMessages) {
        queryClient.setQueryData(["messages", variables.task_id], context.previousMessages);
      }
      toast.error(error.message || "메시지 전송에 실패했습니다.");
    },
    onSuccess: (data) => {
      // 성공 시 관련 쿼리 무효화하여 최신 데이터 가져오기
      queryClient.invalidateQueries({ queryKey: ["messages", data.task_id] });
      // 대시보드의 읽지 않은 메시지 수도 업데이트 (상대방의 대시보드 업데이트)
      queryClient.invalidateQueries({ queryKey: ["tasks", "member"] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "admin"] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "reference"] });
    },
  });
}

/**
 * 파일 메시지 생성 뮤테이션 훅
 */
export function useCreateFileMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      fileUrl,
      fileName,
      fileType,
      fileSize,
    }: {
      taskId: string;
      fileUrl: string;
      fileName: string;
      fileType: string;
      fileSize: number;
    }) => createFileMessage(taskId, fileUrl, fileName, fileType, fileSize),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["messages", data.task_id] });
      // 대시보드의 읽지 않은 메시지 수도 업데이트 (상대방의 대시보드 업데이트)
      queryClient.invalidateQueries({ queryKey: ["tasks", "member"] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "admin"] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "reference"] });
      toast.success("파일이 전송되었습니다.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "파일 전송에 실패했습니다.");
    },
  });
}

/**
 * 텍스트와 파일을 함께 전송하는 뮤테이션 훅
 */
export function useCreateMessageWithFiles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      content,
      files,
      bundleId,
    }: {
      taskId: string;
      content: string | null;
      files: Array<{ url: string; fileName: string; fileType: string; fileSize: number }>;
      bundleId?: string;
    }) => createMessageWithFiles(taskId, content, files, bundleId),
    onMutate: async ({ taskId }) => {
      // 진행 중인 쿼리 취소
      await queryClient.cancelQueries({ queryKey: ["messages", taskId] });
      // 이전 값 백업
      const previousMessages = queryClient.getQueryData(["messages", taskId]);
      return { previousMessages };
    },
    onError: (error, variables, context) => {
      // 에러 발생 시 롤백
      if (context?.previousMessages) {
        queryClient.setQueryData(["messages", variables.taskId], context.previousMessages);
      }
      toast.error(error.message || "메시지 전송에 실패했습니다.");
    },
    onSuccess: (data, variables) => {
      // 성공 시 관련 쿼리 무효화하여 최신 데이터 가져오기
      queryClient.invalidateQueries({ queryKey: ["messages", variables.taskId] });
      // 대시보드의 읽지 않은 메시지 수도 업데이트 (상대방의 대시보드 업데이트)
      queryClient.invalidateQueries({ queryKey: ["tasks", "member"] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "admin"] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "reference"] });
    },
  });
}

/**
 * 메시지 읽음 처리 뮤테이션 훅
 */
export function useMarkMessageAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageId: string) => markMessageAsRead(messageId),
    onSuccess: () => {
      // 읽음 처리 후 메시지 목록 무효화
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      // 로그 내 메시지 read_by 갱신 (chat_logs도 무효화)
      queryClient.invalidateQueries({ queryKey: ["chat_logs"] });
      // 대시보드의 읽지 않은 메시지 수도 업데이트
      queryClient.invalidateQueries({ queryKey: ["tasks", "member"] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "admin"] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "reference"] });
    },
  });
}

/**
 * Task의 모든 메시지 읽음 처리 뮤테이션 훅
 */
export function useMarkTaskMessagesAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => markTaskMessagesAsRead(taskId),
    onSuccess: (_, taskId) => {
      // 읽음 처리 후 메시지 목록 무효화
      queryClient.invalidateQueries({ queryKey: ["messages", taskId] });
      // 로그에 참조된 메시지의 read_by 갱신 (파일 업로드+로그 시 읽음 숫자 반영)
      queryClient.invalidateQueries({ queryKey: ["chat_logs", taskId] });
      // 대시보드의 읽지 않은 메시지 수도 업데이트
      queryClient.invalidateQueries({ queryKey: ["tasks", "member"] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "admin"] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "reference"] });
    },
  });
}

/**
 * 메시지 삭제 뮤테이션 훅 (optimistic update 적용)
 */
export function useDeleteMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageId: string) => deleteMessage(messageId),
    onMutate: async (messageId) => {
      // 진행 중인 쿼리 취소
      await queryClient.cancelQueries({ queryKey: ["messages"] });

      // 모든 메시지 쿼리에서 해당 메시지 찾기
      const queryCache = queryClient.getQueryCache();
      const messageQueries = queryCache.findAll({ queryKey: ["messages"] });

      // 이전 값 백업 (롤백용)
      const previousMessagesMap = new Map();
      messageQueries.forEach((query) => {
        const data = queryClient.getQueryData(query.queryKey);
        if (data) {
          previousMessagesMap.set(query.queryKey, data);
        }
      });

      // Optimistic update: 메시지 목록에서 제거
      messageQueries.forEach((query) => {
        queryClient.setQueryData<MessageWithProfile[] | undefined>(query.queryKey, (old) => {
          if (!old || !Array.isArray(old)) return old;
          return old.filter((msg) => msg.id !== messageId);
        });
      });

      return { previousMessagesMap };
    },
    onError: (error, messageId, context) => {
      // 롤백: 모든 쿼리 복원
      if (context?.previousMessagesMap) {
        context.previousMessagesMap.forEach((data, queryKey) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast.error(error.message || "메시지 삭제에 실패했습니다.");
    },
    onSuccess: () => {
      // 성공 시 관련 쿼리 무효화하여 최신 데이터 가져오기
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      // 대시보드의 읽지 않은 메시지 수도 업데이트
      queryClient.invalidateQueries({ queryKey: ["tasks", "member"] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "admin"] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "reference"] });
      toast.success("메시지가 삭제되었습니다.");
    },
  });
}

