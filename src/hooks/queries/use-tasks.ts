import { useQuery } from "@tanstack/react-query";
import { getTaskById, getTasksForMember, getTasksForAdmin, getSelfTasks, getTasksAsReference } from "@/api/task";
import type { Task, TaskWithProfiles } from "@/api/task";

/**
 * 전체 태스크 목록 조회 훅 (관리자용)
 * 프로젝트 구조 제거 후 모든 태스크를 조회합니다.
 * 
 * @param excludeApproved APPROVED 상태 Task 제외 여부 (기본값: false, 전체 태스크 탭에서는 false)
 */
export function useTasks(excludeApproved: boolean = false) {
  return useQuery<TaskWithProfiles[]>({
    queryKey: ["tasks", "all", excludeApproved],
    queryFn: () => getTasksForAdmin(excludeApproved),
    staleTime: 30 * 1000,
  });
}

/**
 * Task 상세 조회 훅
 */
export function useTask(id: string | undefined) {
  return useQuery<TaskWithProfiles | null>({
    queryKey: ["tasks", "detail", id],
    queryFn: () => (id ? getTaskById(id) : Promise.resolve(null)),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

/**
 * 멤버용 Task 목록 조회 훅
 * 현재 사용자가 담당자 또는 지시자인 Task만 조회
 * 모든 프로젝트에서 Task 조회 (프로젝트별이 아님)
 * 
 * @param excludeApproved APPROVED 상태 Task 제외 여부 (기본값: true)
 */
export function useTasksForMember(excludeApproved: boolean = true) {
  return useQuery<TaskWithProfiles[]>({
    queryKey: ["tasks", "member", excludeApproved],
    queryFn: () => getTasksForMember(excludeApproved),
    staleTime: 30 * 1000,
  });
}

/**
 * Admin용 Task 목록 조회 훅
 * 모든 Task 조회 (APPROVED 제외 옵션)
 * 
 * @param excludeApproved APPROVED 상태 Task 제외 여부 (기본값: true)
 */
export function useTasksForAdmin(excludeApproved: boolean = true) {
  return useQuery<TaskWithProfiles[]>({
    queryKey: ["tasks", "admin", excludeApproved],
    queryFn: () => getTasksForAdmin(excludeApproved),
    staleTime: 30 * 1000,
  });
}

/**
 * 자기 할당 Task 목록 조회 훅
 * 자기 자신에게 할당한 Task만 조회
 * 
 * @param excludeApproved APPROVED 상태 Task 제외 여부 (기본값: false)
 */
export function useSelfTasks(excludeApproved: boolean = false) {
  return useQuery<TaskWithProfiles[]>({
    queryKey: ["tasks", "self", excludeApproved],
    queryFn: () => getSelfTasks(excludeApproved),
    staleTime: 30 * 1000,
  });
}

/**
 * 참조자로 지정된 Task 목록 조회 훅
 * 현재 사용자가 참조자로 지정된 Task만 조회
 */
export function useTasksAsReference() {
  return useQuery<TaskWithProfiles[]>({
    queryKey: ["tasks", "reference"],
    queryFn: () => getTasksAsReference(),
    staleTime: 30 * 1000,
  });
}

