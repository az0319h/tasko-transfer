import type { Database } from "@/database.type";

export type TaskStatus = Database["public"]["Enums"]["task_status"];

/**
 * 상태 전환 매트릭스
 * 각 상태에서 어떤 상태로 전환 가능한지 정의
 */
const STATUS_TRANSITION_MATRIX: Record<TaskStatus, TaskStatus[]> = {
  ASSIGNED: ["IN_PROGRESS"],
  IN_PROGRESS: ["WAITING_CONFIRM"],
  WAITING_CONFIRM: ["APPROVED", "REJECTED"],
  APPROVED: [], // 최종 상태
  REJECTED: ["IN_PROGRESS"], // 반려 후 재작업 가능
};

/**
 * 상태 전환이 유효한지 확인
 */
export function isValidStatusTransition(
  currentStatus: TaskStatus,
  newStatus: TaskStatus,
): boolean {
  const allowedTransitions = STATUS_TRANSITION_MATRIX[currentStatus];
  return allowedTransitions.includes(newStatus);
}

/**
 * 사용자 역할별 허용되는 상태 전환 확인
 * @param userRole - 사용자 역할: "assigner" | "assignee"
 * @param currentStatus - 현재 Task 상태
 * @param newStatus - 변경하려는 상태
 * @returns 전환이 허용되면 true
 */
export function canUserChangeStatus(
  userRole: "assigner" | "assignee",
  currentStatus: TaskStatus,
  newStatus: TaskStatus,
): boolean {
  // 먼저 상태 전환 매트릭스 검증
  if (!isValidStatusTransition(currentStatus, newStatus)) {
    return false;
  }

  // assignee는 ASSIGNED → IN_PROGRESS, IN_PROGRESS → WAITING_CONFIRM, REJECTED → IN_PROGRESS 가능
  if (userRole === "assignee") {
    return (
      (currentStatus === "ASSIGNED" && newStatus === "IN_PROGRESS") ||
      (currentStatus === "IN_PROGRESS" && newStatus === "WAITING_CONFIRM") ||
      (currentStatus === "REJECTED" && newStatus === "IN_PROGRESS")
    );
  }

  // assigner는 WAITING_CONFIRM → APPROVED/REJECTED만 가능
  if (userRole === "assigner") {
    return (
      currentStatus === "WAITING_CONFIRM" &&
      (newStatus === "APPROVED" || newStatus === "REJECTED")
    );
  }

  return false;
}

/**
 * 상태 전환 에러 메시지 생성
 */
export function getStatusTransitionErrorMessage(
  currentStatus: TaskStatus,
  newStatus: TaskStatus,
  userRole?: "assigner" | "assignee",
): string {
  if (!isValidStatusTransition(currentStatus, newStatus)) {
    return `상태를 ${currentStatus}에서 ${newStatus}로 변경할 수 없습니다.`;
  }

  if (userRole) {
    if (!canUserChangeStatus(userRole, currentStatus, newStatus)) {
      return `${userRole === "assignee" ? "담당자" : "지시자"}는 이 상태 변경을 수행할 수 없습니다.`;
    }
  }

  return "상태 변경에 실패했습니다.";
}

