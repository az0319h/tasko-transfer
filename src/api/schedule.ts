import supabase from "@/lib/supabase";
import type { Tables, TablesUpdate } from "@/database.type";
import type { TaskSchedule, TaskScheduleWithTask } from "@/types/domain/schedule";

export type TaskScheduleUpdate = TablesUpdate<"task_schedules">;

/**
 * Get task schedules for a date range
 * Only returns schedules where the current user is assigner or assignee
 * If userId is provided (admin viewing another user's schedule), returns schedules for that user
 * 
 * @param startDate Start date of the range
 * @param endDate End date of the range
 * @param excludeApproved Whether to exclude approved tasks (default: true)
 * @param userId Optional user ID to view specific user's schedules (admin only, read-only mode)
 * @returns Array of task schedules with task information
 */
export async function getTaskSchedules(
  startDate: Date,
  endDate: Date,
  excludeApproved: boolean = true,
  userId?: string
): Promise<TaskScheduleWithTask[]> {

  // Get current user ID
  const { data: session } = await supabase.auth.getSession();
  const currentUserId = session.session?.user?.id;

  if (!currentUserId) {
    throw new Error("인증이 필요합니다.");
  }

  // First, get schedules
  let schedulesQuery = supabase
    .from("task_schedules")
    .select("*")
    .gte("start_time", startDate.toISOString())
    .lte("end_time", endDate.toISOString());

  // Determine which user's schedules to show
  // If userId is provided (admin viewing another user), filter by that user's assignee_id
  // If userId is undefined, filter by current user's assignee_id (even for admin)
  const targetUserId = userId || currentUserId;

  // Get tasks where the target user is assignee
  // 자기 할당 Task는 제외
  const { data: userTasks, error: tasksError } = await supabase
    .from("tasks")
    .select("id")
    .eq("assignee_id", targetUserId)
    .eq("is_self_task", false); // 자기 할당 Task 제외

  if (tasksError) {
    console.error("사용자 Task 조회 에러:", tasksError);
    throw new Error(`사용자 Task 조회 실패: ${tasksError.message}`);
  }

  const taskIds = userTasks?.map((t) => t.id) || [];
  if (taskIds.length === 0) {
    return [];
  }

  schedulesQuery = schedulesQuery.in("task_id", taskIds);

  const { data: schedules, error: schedulesError } = await schedulesQuery.order("start_time", { ascending: true });

  if (schedulesError) {
    console.error("일정 조회 에러:", schedulesError);
    console.error("조회 기간:", startDate.toISOString(), "~", endDate.toISOString());
    throw new Error(`일정 조회 실패: ${schedulesError.message}`);
  }

  if (!schedules || schedules.length === 0) {
    return [];
  }

  // Then, get task information for each schedule
  const scheduleTaskIds = schedules.map((s) => s.task_id);
  const { data: tasks, error: tasksFetchError } = await supabase
    .from("tasks")
    .select("id, title, task_category, task_status, assigner_id, assignee_id, client_name, created_at, due_date")
    .in("id", scheduleTaskIds);

  if (tasksFetchError) {
    console.error("Task 조회 에러:", tasksFetchError);
    throw new Error(`Task 조회 실패: ${tasksFetchError.message}`);
  }

  // Create a map for quick lookup
  const taskMap = new Map(tasks?.map((t) => [t.id, t]) || []);

  // Combine schedules with tasks
  const data = schedules
    .map((schedule) => ({
      ...schedule,
      task: taskMap.get(schedule.task_id),
    }))
    .filter((item) => item.task !== undefined); // Filter out schedules without tasks

  if (!data) {
    return [];
  }

  // Transform the data to match TaskScheduleWithTask type
  // Filter out approved tasks if requested (though trigger should have deleted them)
  return data
    .filter((item): item is typeof item & { task: NonNullable<typeof item.task> } => {
      // Type guard: ensure task exists
      if (!item.task) {
        return false;
      }
      // Filter out approved tasks if requested
      if (excludeApproved && item.task.task_status === "APPROVED") {
        return false;
      }
      return true;
    })
    .map((item) => ({
      id: item.id,
      task_id: item.task_id,
      start_time: new Date(item.start_time),
      end_time: new Date(item.end_time),
      is_all_day: item.is_all_day,
      created_at: new Date(item.created_at),
      updated_at: new Date(item.updated_at),
      task: {
        id: item.task.id,
        title: item.task.title,
        task_category: item.task.task_category,
        task_status: item.task.task_status,
        assigner_id: item.task.assigner_id,
        assignee_id: item.task.assignee_id,
        client_name: item.task.client_name,
        created_at: item.task.created_at,
        due_date: item.task.due_date,
      },
    }));
}

/**
 * Update task schedule
 * Only assigner or assignee can update schedules
 * 
 * @param id Schedule ID
 * @param updates Schedule updates (start_time, end_time, is_all_day)
 * @returns Updated task schedule
 */
export async function updateTaskSchedule(
  id: string,
  updates: {
    start_time?: Date;
    end_time?: Date;
    is_all_day?: boolean;
  }
): Promise<TaskSchedule> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("인증이 필요합니다.");
  }

  // Prepare update object
  const updateData: TaskScheduleUpdate = {
    updated_at: new Date().toISOString(),
  };

  if (updates.start_time !== undefined) {
    updateData.start_time = updates.start_time.toISOString();
  }

  if (updates.end_time !== undefined) {
    updateData.end_time = updates.end_time.toISOString();
  }

  if (updates.is_all_day !== undefined) {
    updateData.is_all_day = updates.is_all_day;
  }

  const { data, error } = await supabase
    .from("task_schedules")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("일정 업데이트 API 에러:", error);
    console.error("에러 상세:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    throw new Error(`일정 수정 실패: ${error.message}`);
  }

  if (!data) {
    console.error("일정 업데이트 결과 없음");
    throw new Error("일정을 찾을 수 없습니다.");
  }

  return {
    ...data,
    start_time: new Date(data.start_time),
    end_time: new Date(data.end_time),
    created_at: new Date(data.created_at),
    updated_at: new Date(data.updated_at),
  };
}
