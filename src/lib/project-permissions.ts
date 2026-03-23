import type { Task } from "@/api/task";
import { useCurrentProfile } from "@/hooks";
import { useIsAdmin } from "@/hooks";

/**
 * Task 수정 권한 확인
 * - 지시자(assigner)만 Task 수정 가능
 */
export function canEditTask(
  task: Task,
  userId: string | undefined,
  isAdmin: boolean
): boolean {
  if (!userId) {
    return false;
  }

  // 지시자(assigner)만 수정 가능
  return task.assigner_id === userId;
}

