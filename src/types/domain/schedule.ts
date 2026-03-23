import type { Database, Tables } from "@/database.type";

export type TaskCategory = Database["public"]["Enums"]["task_category"];
export type TaskStatus = Database["public"]["Enums"]["task_status"];

// Database schedule type (with Date conversion)
export type TaskSchedule = Omit<Tables<"task_schedules">, "start_time" | "end_time" | "created_at" | "updated_at"> & {
  start_time: Date;
  end_time: Date;
  created_at: Date;
  updated_at: Date;
};

// Schedule with task information (for queries with JOIN)
export interface TaskScheduleWithTask {
  id: string;
  task_id: string;
  start_time: Date;
  end_time: Date;
  is_all_day: boolean;
  created_at: Date;
  updated_at: Date;
  task: {
    id: string;
    title: string;
    task_category: TaskCategory;
    task_status: TaskStatus;
    assigner_id: string | null;
    assignee_id: string | null;
    client_name: string | null;
    created_at: string;
    due_date: string | null;
  };
}

// FullCalendar event format
export interface FullCalendarEvent {
  id: string;
  title: string;
  start: Date | string;
  end?: Date | string;
  allDay?: boolean;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  editable?: boolean; // 드래그/리사이즈 가능 여부
  extendedProps?: {
    taskId: string;
    taskCategory: TaskCategory;
    taskStatus: TaskStatus;
    taskClientName?: string | null;
    taskCreatedAt?: string;
    taskDueDate?: string | null;
  };
}
