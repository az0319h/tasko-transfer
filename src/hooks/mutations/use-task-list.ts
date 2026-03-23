import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createTaskList,
  updateTaskList,
  deleteTaskList,
  addTaskToList,
  removeTaskFromList,
  updateTaskListItemsOrder,
  type TaskList,
  type TaskListItem,
} from "@/api/task-list";
import { toast } from "sonner";

/**
 * Task 목록 생성 뮤테이션 훅
 */
export function useCreateTaskList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (title: string) => createTaskList(title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-lists"] });
      toast.success("업무 목록이 생성되었습니다.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "업무 목록 생성에 실패했습니다.");
    },
  });
}

/**
 * Task 목록 제목 수정 뮤테이션 훅
 */
export function useUpdateTaskList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ listId, title }: { listId: string; title: string }) =>
      updateTaskList(listId, title),
    onSuccess: (data, variables) => {
      // 모든 관련 쿼리 무효화하여 최신 데이터 자동 조회
      queryClient.invalidateQueries({ queryKey: ["task-lists"] });
      // 상세 페이지 쿼리도 무효화하여 items 포함한 전체 데이터 다시 조회
      queryClient.invalidateQueries({ queryKey: ["task-lists", "detail", variables.listId] });
      toast.success("업무 목록이 수정되었습니다.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "업무 목록 수정에 실패했습니다.");
    },
  });
}

/**
 * Task 목록 삭제 뮤테이션 훅
 */
export function useDeleteTaskList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (listId: string) => deleteTaskList(listId),
    onSuccess: (_, listId) => {
      queryClient.invalidateQueries({ queryKey: ["task-lists"] });
      queryClient.removeQueries({ queryKey: ["task-lists", "detail", listId] });
      queryClient.removeQueries({ queryKey: ["task-lists", "items", listId] });
      toast.success("업무 목록이 삭제되었습니다.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "업무 목록 삭제에 실패했습니다.");
    },
  });
}

/**
 * 목록에 Task 추가 뮤테이션 훅
 */
export function useAddTaskToList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ listId, taskId }: { listId: string; taskId: string }) =>
      addTaskToList(listId, taskId),
    onSuccess: (_, variables) => {
      // 관련 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ["task-lists", "detail", variables.listId] });
      queryClient.invalidateQueries({ queryKey: ["task-lists", "items", variables.listId] });
      queryClient.invalidateQueries({ queryKey: ["task-lists", "for-task", variables.taskId] });
      queryClient.invalidateQueries({ queryKey: ["task-lists", "list"] });
      toast.success("Task가 목록에 추가되었습니다.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Task 추가에 실패했습니다.");
    },
  });
}

/**
 * 목록에서 Task 제거 뮤테이션 훅
 */
export function useRemoveTaskFromList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ listId, taskId }: { listId: string; taskId: string }) =>
      removeTaskFromList(listId, taskId),
    onSuccess: (_, variables) => {
      // 관련 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ["task-lists", "detail", variables.listId] });
      queryClient.invalidateQueries({ queryKey: ["task-lists", "items", variables.listId] });
      queryClient.invalidateQueries({ queryKey: ["task-lists", "for-task", variables.taskId] });
      queryClient.invalidateQueries({ queryKey: ["task-lists", "list"] });
      toast.success("업무가 목록에서 제거되었습니다.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "업무 제거에 실패했습니다.");
    },
  });
}

/**
 * Task 목록 항목 순서 업데이트 뮤테이션 훅
 */
export function useUpdateTaskListItemsOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      listId,
      itemOrders,
    }: {
      listId: string;
      itemOrders: Array<{ itemId: string; displayOrder: number }>;
    }) => updateTaskListItemsOrder(listId, itemOrders),
    onSuccess: (_, variables) => {
      // 관련 쿼리 무효화하여 최신 순서 반영
      queryClient.invalidateQueries({ queryKey: ["task-lists", "detail", variables.listId] });
      queryClient.invalidateQueries({ queryKey: ["task-lists", "items", variables.listId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "순서 업데이트에 실패했습니다.");
    },
  });
}
