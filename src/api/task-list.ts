import supabase from "@/lib/supabase";
import type { Tables, TablesInsert, TablesUpdate } from "@/database.type";
import type { TaskWithProfiles } from "./task";

export type TaskList = Tables<"task_lists">;
export type TaskListInsert = TablesInsert<"task_lists">;
export type TaskListUpdate = TablesUpdate<"task_lists">;

export type TaskListItem = Tables<"task_list_items">;
export type TaskListItemInsert = TablesInsert<"task_list_items">;

/**
 * Task 목록에 포함된 Task 정보를 포함한 타입
 */
export type TaskListWithItems = TaskList & {
  items: Array<{
    id: string;
    task_id: string;
    created_at: string;
    display_order: number;
    task: TaskWithProfiles;
  }>;
  item_count: number;
};

/**
 * Task가 포함된 목록 정보
 */
export type TaskListForTask = TaskList & {
  has_task: boolean; // 현재 Task가 포함되어 있는지 여부
};

/**
 * 사용자의 Task 목록 목록 조회 (각 목록의 Task 개수 포함)
 */
export async function getTaskLists(): Promise<Array<TaskList & { item_count: number }>> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("인증이 필요합니다.");
  }

  // 목록 조회
  const { data: lists, error: listsError } = await supabase
    .from("task_lists")
    .select("*")
    .order("created_at", { ascending: false });

  if (listsError) {
    throw new Error(`Task 목록 조회 실패: ${listsError.message}`);
  }

  if (!lists || lists.length === 0) {
    return [];
  }

  // 각 목록의 Task 개수 조회
  const listIds = lists.map((list) => list.id);
  const { data: counts, error: countsError } = await supabase
    .from("task_list_items")
    .select("task_list_id")
    .in("task_list_id", listIds);

  if (countsError) {
    throw new Error(`Task 개수 조회 실패: ${countsError.message}`);
  }

  // 목록별 개수 계산
  const countMap = new Map<string, number>();
  (counts || []).forEach((item) => {
    const currentCount = countMap.get(item.task_list_id) || 0;
    countMap.set(item.task_list_id, currentCount + 1);
  });

  // 목록에 개수 추가
  return lists.map((list) => ({
    ...list,
    item_count: countMap.get(list.id) || 0,
  }));
}

/**
 * 특정 Task 목록 조회 (Task 목록 포함)
 */
export async function getTaskList(listId: string): Promise<TaskListWithItems | null> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("인증이 필요합니다.");
  }

  // 목록 조회
  const { data: list, error: listError } = await supabase
    .from("task_lists")
    .select("*")
    .eq("id", listId)
    .single();

  if (listError) {
    if (listError.code === "PGRST116") {
      return null;
    }
    throw new Error(`Task 목록 조회 실패: ${listError.message}`);
  }

  if (!list) {
    return null;
  }

  // 목록에 포함된 Task 항목 조회 (display_order 기준으로 정렬)
  const { data: items, error: itemsError } = await supabase
    .from("task_list_items")
    .select(`
      id,
      task_id,
      created_at,
      display_order,
      task:tasks!task_list_items_task_id_fkey(
        *,
        assigner:profiles!tasks_assigner_id_fkey(id, full_name, email, avatar_url),
        assignee:profiles!tasks_assignee_id_fkey(id, full_name, email, avatar_url)
      )
    `)
    .eq("task_list_id", listId)
    .order("display_order", { ascending: true });

  if (itemsError) {
    throw new Error(`Task 목록 항목 조회 실패: ${itemsError.message}`);
  }

  return {
    ...list,
    items: items || [],
    item_count: items?.length || 0,
  } as TaskListWithItems;
}

/**
 * 목록에 포함된 Task 목록 조회
 */
export async function getTaskListItems(listId: string): Promise<TaskListItem[]> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("인증이 필요합니다.");
  }

  const { data, error } = await supabase
    .from("task_list_items")
    .select("*")
    .eq("task_list_id", listId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Task 목록 항목 조회 실패: ${error.message}`);
  }

  return data || [];
}

/**
 * Task 목록 생성
 */
export async function createTaskList(title: string): Promise<TaskList> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("인증이 필요합니다.");
  }

  const userId = session.session.user.id;

  const { data, error } = await supabase
    .from("task_lists")
    .insert({
      title: title.trim(),
      user_id: userId,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Task 목록 생성 실패: ${error.message}`);
  }

  return data;
}

/**
 * Task 목록 제목 수정
 */
export async function updateTaskList(listId: string, title: string): Promise<TaskList> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("인증이 필요합니다.");
  }

  const { data, error } = await supabase
    .from("task_lists")
    .update({
      title: title.trim(),
    })
    .eq("id", listId)
    .select()
    .single();

  if (error) {
    throw new Error(`Task 목록 수정 실패: ${error.message}`);
  }

  return data;
}

/**
 * Task 목록 삭제
 */
export async function deleteTaskList(listId: string): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("인증이 필요합니다.");
  }

  const { error } = await supabase
    .from("task_lists")
    .delete()
    .eq("id", listId);

  if (error) {
    throw new Error(`Task 목록 삭제 실패: ${error.message}`);
  }
}

/**
 * 목록에 Task 추가 (마지막 순서로 추가)
 */
export async function addTaskToList(listId: string, taskId: string): Promise<TaskListItem> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("인증이 필요합니다.");
  }

  // 현재 목록의 마지막 display_order 조회
  const { data: lastItem, error: lastItemError } = await supabase
    .from("task_list_items")
    .select("display_order")
    .eq("task_list_id", listId)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 마지막 순서 + 1 (없으면 0)
  const nextOrder = lastItem ? lastItem.display_order + 1 : 0;

  const { data, error } = await supabase
    .from("task_list_items")
    .insert({
      task_list_id: listId,
      task_id: taskId,
      display_order: nextOrder,
    })
    .select()
    .single();

  if (error) {
    // 중복 추가 시도 시 에러 처리
    if (error.code === "23505") {
      throw new Error("이미 목록에 추가된 업무입니다.");
    }
    throw new Error(`Task 추가 실패: ${error.message}`);
  }

  return data;
}

/**
 * Task 목록 항목들의 순서 업데이트 (배치 업데이트)
 * UNIQUE 제약조건 충돌을 피하기 위해 2단계 업데이트 사용:
 * 1. 모든 항목을 임시 음수 값으로 변경
 * 2. 실제 순서 값으로 변경
 */
export async function updateTaskListItemsOrder(
  listId: string,
  itemOrders: Array<{ itemId: string; displayOrder: number }>
): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("인증이 필요합니다.");
  }

  // 1단계: 모든 항목을 임시 음수 값으로 변경 (UNIQUE 제약조건 충돌 방지)
  const tempUpdatePromises = itemOrders.map(({ itemId }, index) =>
    supabase
      .from("task_list_items")
      .update({ display_order: -(index + 1) }) // 음수 값 사용 (임시)
      .eq("id", itemId)
      .eq("task_list_id", listId)
      .select() // 결과 확인을 위해 select 추가
  );

  const tempResults = await Promise.all(tempUpdatePromises);
  
  // 에러 확인 및 결과 검증
  for (let i = 0; i < tempResults.length; i++) {
    const result = tempResults[i];
    if (result.error) {
      console.error(`임시 단계 업데이트 실패 [${i}]:`, result.error);
      throw new Error(`순서 업데이트 실패 (임시 단계): ${result.error.message}`);
    }
    // 업데이트된 행이 없는 경우도 확인
    if (!result.data || result.data.length === 0) {
      console.error(`임시 단계 업데이트 결과 없음 [${i}]:`, itemOrders[i]);
      throw new Error(`순서 업데이트 실패 (임시 단계): 항목을 찾을 수 없거나 권한이 없습니다.`);
    }
  }

  // 2단계: 실제 순서 값으로 변경
  const finalUpdatePromises = itemOrders.map(({ itemId, displayOrder }) =>
    supabase
      .from("task_list_items")
      .update({ display_order: displayOrder })
      .eq("id", itemId)
      .eq("task_list_id", listId)
      .select() // 결과 확인을 위해 select 추가
  );

  const finalResults = await Promise.all(finalUpdatePromises);
  
  // 에러 확인 및 결과 검증
  for (let i = 0; i < finalResults.length; i++) {
    const result = finalResults[i];
    if (result.error) {
      console.error(`최종 단계 업데이트 실패 [${i}]:`, result.error);
      throw new Error(`순서 업데이트 실패 (최종 단계): ${result.error.message}`);
    }
    // 업데이트된 행이 없는 경우도 확인
    if (!result.data || result.data.length === 0) {
      console.error(`최종 단계 업데이트 결과 없음 [${i}]:`, itemOrders[i]);
      throw new Error(`순서 업데이트 실패 (최종 단계): 항목을 찾을 수 없거나 권한이 없습니다.`);
    }
  }
}

/**
 * 목록에서 Task 제거
 */
export async function removeTaskFromList(listId: string, taskId: string): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("인증이 필요합니다.");
  }

  const { error } = await supabase
    .from("task_list_items")
    .delete()
    .eq("task_list_id", listId)
    .eq("task_id", taskId);

  if (error) {
    throw new Error(`Task 제거 실패: ${error.message}`);
  }
}

/**
 * 특정 Task가 포함된 목록 목록 조회 (체크 표시용)
 * 현재 Task가 어떤 목록에 포함되어 있는지 확인
 */
export async function getTaskListsForTask(taskId: string): Promise<TaskListForTask[]> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("인증이 필요합니다.");
  }

  // 사용자의 모든 목록 조회
  const { data: lists, error: listsError } = await supabase
    .from("task_lists")
    .select("*")
    .order("created_at", { ascending: false });

  if (listsError) {
    throw new Error(`Task 목록 조회 실패: ${listsError.message}`);
  }

  if (!lists || lists.length === 0) {
    return [];
  }

  // 현재 Task가 포함된 목록 ID 조회
  const { data: items, error: itemsError } = await supabase
    .from("task_list_items")
    .select("task_list_id")
    .eq("task_id", taskId);

  if (itemsError) {
    throw new Error(`Task 목록 항목 조회 실패: ${itemsError.message}`);
  }

  const taskListIds = new Set(items?.map((item) => item.task_list_id) || []);

  // 목록에 has_task 플래그 추가
  return lists.map((list) => ({
    ...list,
    has_task: taskListIds.has(list.id),
  })) as TaskListForTask[];
}
