import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  type TaskInsert,
  type TaskUpdate,
  type TaskWithProfiles,
} from "@/api/task";

export type CreateTaskInput = Omit<TaskInsert, "assigner_id"> & {
  is_self_task?: boolean;
  reference_ids?: string[];
};
import type { TaskStatus } from "@/lib/task-status";
import { toast } from "sonner";

/**
 * Task 생성 뮤테이션 훅 (프로젝트 참여자 또는 Admin 가능)
 * assigner_id는 자동으로 현재 로그인한 사용자로 설정됨
 */
export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (task: CreateTaskInput) => createTask(task),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      toast.success("업무가 생성되었습니다.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "업무 생성에 실패했습니다.");
    },
  });
}

/**
 * Task 수정 뮤테이션 훅
 */
export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: TaskUpdate }) =>
      updateTask(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "detail", data.id] });
      queryClient.invalidateQueries({ queryKey: ["task-lists"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      toast.success("업무가 수정되었습니다.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "업무 수정에 실패했습니다.");
    },
  });
}

/**
 * Task 삭제 뮤테이션 훅
 */
export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-lists"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      toast.success("업무가 삭제되었습니다.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "업무 삭제에 실패했습니다.");
    },
  });
}

/**
 * Task 상태 변경 뮤테이션 훅
 * - optimistic update 적용
 * - 실패 시 롤백 처리
 */
export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, newStatus }: { taskId: string; newStatus: TaskStatus }) =>
      updateTaskStatus(taskId, newStatus),
    onMutate: async ({ taskId, newStatus }) => {
      // 진행 중인 쿼리 취소
      await queryClient.cancelQueries({ queryKey: ["tasks"] });

      // 이전 값 백업 (롤백용)
      const previousTasks = queryClient.getQueriesData({ queryKey: ["tasks"] });

      // Optimistic update: 모든 관련 Task 목록 쿼리를 업데이트
      // 주의: queryKey: ["tasks"]는 prefix 매칭으로 배열 쿼리(["tasks", projectId])와
      // 단일 객체 쿼리(["tasks", "detail", id]) 모두 매칭되므로 타입 가드 필요
      queryClient.setQueriesData<TaskWithProfiles[] | TaskWithProfiles | null>(
        { queryKey: ["tasks"] },
        (old) => {
          if (!old) return old;
          
          // 배열인 경우 (프로젝트별 Task 목록 쿼리)
          if (Array.isArray(old)) {
            return old.map((task) =>
              task.id === taskId ? { ...task, task_status: newStatus } : task,
            );
          }
          
          // 단일 객체인 경우 (Task 상세 쿼리)
          if (typeof old === "object" && old !== null && "id" in old && old.id === taskId) {
            return { ...old, task_status: newStatus };
          }
          
          // 매칭되지 않는 경우 원본 반환
          return old;
        },
      );

      return { previousTasks };
    },
    onError: (error, variables, context) => {
      // 에러 발생 시 롤백
      if (context?.previousTasks) {
        context.previousTasks.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast.error(error.message || "상태 변경에 실패했습니다.");
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "detail", data.id] });
      queryClient.invalidateQueries({ queryKey: ["task-lists"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      toast.success("상태가 변경되었습니다.");
    },
  });
}

