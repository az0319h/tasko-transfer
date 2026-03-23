import type { TaskScheduleWithTask, FullCalendarEvent, TaskStatus, TaskCategory } from "@/types/domain/schedule";
import {
  FileText,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Get status icon and color for task status
 * 일정 관리 페이지: 모든 아이콘은 기본 색상으로 통일 (할당됨 아이콘과 동일)
 */
export function getStatusIcon(status: TaskStatus): {
  icon: LucideIcon;
  color: string;
  hasOpacity?: boolean;
} {
  const statusConfig: Record<
    TaskStatus,
    {
      icon: LucideIcon;
      color: string;
      hasOpacity?: boolean;
    }
  > = {
    ASSIGNED: {
      icon: FileText,
      color: "", // 기본 색상
    },
    IN_PROGRESS: {
      icon: Loader2,
      color: "", // 기본 색상으로 통일
    },
    WAITING_CONFIRM: {
      icon: Clock,
      color: "", // 기본 색상으로 통일
    },
    APPROVED: {
      icon: CheckCircle2,
      color: "", // 기본 색상으로 통일
    },
    REJECTED: {
      icon: XCircle,
      color: "", // 기본 색상으로 통일
      hasOpacity: true,
    },
  };

  return statusConfig[status];
}

/**
 * Get color for task category
 * 카테고리별 색상: REVIEW(검토): 파란색, REVISION(수정): 보라색, CONTRACT(계약): 노란색, SPECIFICATION(명세서): 주황색, APPLICATION(출원): 청록색
 * CONTRACT는 APPROVED 상태의 녹색과 구분하기 위해 노란색 사용
 */
export function getCategoryColor(category: TaskCategory): string {
  const categoryColors: Record<TaskCategory, string> = {
    REVIEW: "#3b82f6", // blue-500 - 파란색
    REVISION: "#a855f7", // purple-500 - 보라색
    CONTRACT: "#eab308", // yellow-500 - 노란색 (APPROVED 녹색과 구분)
    SPECIFICATION: "#f97316", // orange-500 - 주황색
    APPLICATION: "#14b8a6", // teal-500 - 청록색
  };
  return categoryColors[category] || "#3b82f6";
}

/**
 * Get background color for task status (일정 관리 페이지용)
 * 배경색은 각 상태의 원래 아이콘 색상으로 표시
 */
export function getStatusBackgroundColor(status: TaskStatus): string {
  const statusColors: Record<TaskStatus, string> = {
    ASSIGNED: "#3b82f6", // blue-500 - 파란색 계열
    IN_PROGRESS: "#eab308", // yellow-500 - 노란색
    WAITING_CONFIRM: "#ef4444", // red-500 - 빨간색
    APPROVED: "#22c55e", // green-500 - 녹색
    REJECTED: "rgba(239, 68, 68, 0.5)", // red-500 with 50% opacity
  };
  return statusColors[status] || "#3b82f6";
}

/**
 * Convert TaskScheduleWithTask to FullCalendar event format
 */
export function convertToFullCalendarEvents(
  schedules: TaskScheduleWithTask[]
): FullCalendarEvent[] {
  return schedules
    .map((schedule) => {
      // 종일 일정의 경우 end가 없을 수 있으므로 확인
      let endTime = schedule.end_time;
      if (schedule.is_all_day && endTime) {
        // 종일 일정의 경우 end_time이 다음 날 00:00:00일 수 있으므로
        // FullCalendar가 올바르게 처리하도록 Date 객체로 변환
        endTime = new Date(endTime);
      }

      const taskStatus = schedule.task.task_status;
      
      // 일정 관리 페이지: 배경색은 상태별 색상으로 표시 (아이콘은 모두 기본 색상)
      const backgroundColor = getStatusBackgroundColor(taskStatus);

      const event: FullCalendarEvent = {
        id: schedule.id,
        title: schedule.task.title,
        start: schedule.start_time instanceof Date ? schedule.start_time : new Date(schedule.start_time),
        end: endTime instanceof Date ? endTime : endTime ? new Date(endTime) : undefined,
        allDay: schedule.is_all_day,
        backgroundColor,
        editable: true, // 모든 상태의 일정 편집 가능
        extendedProps: {
          taskId: schedule.task_id,
          taskCategory: schedule.task.task_category,
          taskStatus: schedule.task.task_status,
          taskClientName: schedule.task.client_name,
          taskCreatedAt: schedule.task.created_at,
          taskDueDate: schedule.task.due_date,
        },
      };

      return event;
    });
}
