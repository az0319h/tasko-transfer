import type { TaskWithProfiles } from "@/api/task";

export interface TaskStats {
  total: number;
  inProgress: number;
  approved: number;
}

/**
 * Task 목록에서 통계 계산
 * 진행중: ASSIGNED + IN_PROGRESS + WAITING_CONFIRM + REJECTED
 * 승인됨: APPROVED
 */
export function calculateTaskStats(tasks: TaskWithProfiles[]): TaskStats {
  const stats: TaskStats = {
    total: tasks.length,
    inProgress: 0,
    approved: 0,
  };

  tasks.forEach((task) => {
    if (task.task_status === "APPROVED") {
      stats.approved++;
    } else {
      // ASSIGNED, IN_PROGRESS, WAITING_CONFIRM, REJECTED 모두 진행중으로 간주
      stats.inProgress++;
    }
  });

  return stats;
}

