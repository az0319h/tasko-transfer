import { useQuery } from "@tanstack/react-query";
import {
  getTaskLists,
  getTaskList,
  getTaskListItems,
  getTaskListsForTask,
  type TaskList,
  type TaskListWithItems,
  type TaskListForTask,
  type TaskListItem,
} from "@/api/task-list";

/**
 * 사용자의 Task 목록 목록 조회 훅 (각 목록의 Task 개수 포함)
 */
export function useTaskLists() {
  return useQuery<Array<TaskList & { item_count: number }>>({
    queryKey: ["task-lists", "list"],
    queryFn: () => getTaskLists(),
    staleTime: 30 * 1000, // 30초간 캐시
  });
}

/**
 * 특정 Task 목록 조회 훅 (Task 목록 포함)
 */
export function useTaskList(listId: string | undefined) {
  return useQuery<TaskListWithItems | null>({
    queryKey: ["task-lists", "detail", listId],
    queryFn: () => (listId ? getTaskList(listId) : Promise.resolve(null)),
    enabled: !!listId,
    staleTime: 30 * 1000,
  });
}

/**
 * 목록에 포함된 Task 목록 조회 훅
 */
export function useTaskListItems(listId: string | undefined) {
  return useQuery<TaskListItem[]>({
    queryKey: ["task-lists", "items", listId],
    queryFn: () => (listId ? getTaskListItems(listId) : Promise.resolve([])),
    enabled: !!listId,
    staleTime: 30 * 1000,
  });
}

/**
 * 특정 Task가 포함된 목록 목록 조회 훅 (체크 표시용)
 */
export function useTaskListsForTask(taskId: string | undefined) {
  return useQuery<TaskListForTask[]>({
    queryKey: ["task-lists", "for-task", taskId],
    queryFn: () => (taskId ? getTaskListsForTask(taskId) : Promise.resolve([])),
    enabled: !!taskId,
    staleTime: 30 * 1000,
  });
}
