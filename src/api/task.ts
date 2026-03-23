import supabase from "@/lib/supabase";
import type { Tables, TablesInsert, TablesUpdate } from "@/database.type";
import type { TaskStatus } from "@/lib/task-status";
import {
  canUserChangeStatus,
  getStatusTransitionErrorMessage,
  isValidStatusTransition,
} from "@/lib/task-status";
import { getUnreadMessageCounts } from "./message";
import { checkAdminPermission } from "./admin";

export type Task = Tables<"tasks">;
export type TaskInsert = TablesInsert<"tasks">;
export type TaskUpdate = TablesUpdate<"tasks">;

/**
 * Task with joined profile information for assigner and assignee
 */
export type TaskWithProfiles = Task & {
  assigner: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  } | null;
  assignee: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  } | null;
  references?: Array<{
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  }>; // 참조자 목록
  unread_message_count?: number; // 읽지 않은 메시지 수
};

/**
 * 프로젝트의 Task 목록 조회 (deprecated)
 * 프로젝트 구조가 제거되어 더 이상 사용되지 않습니다.
 * @deprecated 프로젝트 구조가 제거되었습니다. getTasksForAdmin 또는 getTasksForMember를 사용하세요.
 */
export async function getTasksByProjectId(_projectId: string): Promise<TaskWithProfiles[]> {
  throw new Error("프로젝트 구조가 제거되었습니다. getTasksForAdmin 또는 getTasksForMember를 사용하세요.");
}

/**
 * Task 상세 조회
 * assigner와 assignee의 프로필 정보를 JOIN하여 함께 반환
 * 
 * 권한별 접근 제어:
 * - Admin: 모든 Task 상세 접근 가능
 * - 자기 할당 Task: 본인만 접근 가능
 * - Member (assigner/assignee/참조자): 자신의 Task 상세 접근 가능
 * - Member (기타): 접근 불가
 */
export async function getTaskById(id: string): Promise<TaskWithProfiles | null> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("인증이 필요합니다.");
  }

  const userId = session.session.user.id;

  // Task 조회 (참조자 정보 포함)
  const { data, error } = await supabase
    .from("tasks")
    .select(`
      *,
      assigner:profiles!tasks_assigner_id_fkey(id, full_name, email, avatar_url),
      assignee:profiles!tasks_assignee_id_fkey(id, full_name, email, avatar_url)
    `)
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Task 조회 실패: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  // 참조자 목록 조회 (user_id FK로 profiles 조인)
  const { data: referenceData, error: refError } = await supabase
    .from("task_references")
    .select(`
      profiles(id, full_name, email, avatar_url)
    `)
    .eq("task_id", id);

  if (refError) {
    throw new Error(`참조자 조회 실패: ${refError.message}`);
  }

  // 참조자 목록 매핑 (profiles가 객체로 반환됨)
  type RefRow = { profiles: { id: string; full_name: string | null; email: string; avatar_url: string | null } | null };
  const references = (referenceData as RefRow[] | null)?.map((ref) => ref.profiles).filter(Boolean) || [];

  // Admin 권한 확인
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  const isAdmin = profile?.role === "admin";
  const isAssigner = data.assigner_id === userId;
  const isAssignee = data.assignee_id === userId;
  const isReference = references.some((ref) => ref?.id === userId);

  // 권한 검증: Admin, assigner, assignee, 참조자만 접근 가능
  if (data.is_self_task && !isAssigner) {
    return null;
  }

  if (!isAdmin && !isAssigner && !isAssignee && !isReference) {
    // 일반 멤버가 자신의 Task가 아니고 참조자도 아닌 경우: 접근 거부
    return null;
  }

  // Admin 또는 assigner/assignee/참조자: 모든 필드 반환
  return { ...data, references } as TaskWithProfiles;
}

/**
 * Task 생성 (프로젝트 참여자 또는 Admin 가능)
 * - assigner_id는 자동으로 현재 로그인한 사용자로 설정됨
 * - assignee_id는 필수 입력값 (단, is_self_task = true일 때는 자동 설정)
 * - assigner와 assignee는 모두 해당 프로젝트에 속한 사용자여야 함
 * - is_self_task = true일 때: assignee_id 자동 설정, task_status = IN_PROGRESS 자동 설정
 * - reference_ids: 참조자 목록 (선택 사항, 0명 이상)
 */
export async function createTask(
  task: Omit<TaskInsert, "assigner_id"> & { 
    is_self_task?: boolean;
    reference_ids?: string[];
  }
): Promise<Task> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("인증이 필요합니다.");
  }

  const currentUserId = session.session.user.id;
  const isSelfTask = task.is_self_task === true;
  const referenceIds = task.reference_ids || [];

  // Admin 권한 확인
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", currentUserId)
    .single();

  const isAdmin = profile?.role === "admin";

  // 프로젝트 구조가 제거되어 프로젝트 참여자 확인 로직 제거
  // 모든 인증된 사용자가 Task를 생성할 수 있습니다.

  // 자기 할당 Task 처리
  if (isSelfTask) {
    // 자기 할당 Task: assignee_id 자동 설정, task_status 자동 설정
    // reference_ids는 tasks 테이블에 없으므로 제거 (별도 task_references에 insert)
    const { reference_ids: _refIdsSelf, ...taskWithoutRefsSelf } = task;
    const built = {
      ...taskWithoutRefsSelf,
      assigner_id: currentUserId,
      assignee_id: currentUserId, // 자기 자신으로 자동 설정
      task_status: "IN_PROGRESS" as const,
      is_self_task: true,
      created_by: currentUserId,
    } as Record<string, unknown>;
    delete built.project_id;
    delete built.description;
    delete built.reference_ids;
    const taskWithAssigner = built as TaskInsert;

    const { data, error } = await supabase
      .from("tasks")
      .insert(taskWithAssigner)
      .select()
      .single();

    if (error) {
      throw new Error(`업무 생성 실패: ${error.message}`);
    }

    // 참조자 추가 (bulk insert)
    if (referenceIds.length > 0) {
      const referenceRows = referenceIds.map((userId) => ({
        task_id: data.id,
        user_id: userId,
      }));

      const { error: refError } = await supabase
        .from("task_references")
        .insert(referenceRows);

      if (refError) {
        console.error("참조자 추가 실패:", refError);
        throw new Error(`Task는 생성되었으나 참조자 추가에 실패했습니다: ${refError.message}`);
      }
    }

    return data;
  }

  // 일반 Task 처리
  // assignee_id가 설정되어 있는지 확인
  if (!task.assignee_id) {
    throw new Error("할당받은 사람을 선택해주세요.");
  }

  // assigner와 assignee가 같은지 확인 (일반 Task는 자기 할당 불가)
  if (currentUserId === task.assignee_id) {
    throw new Error("자기 자신에게 Task를 할당할 수 없습니다.");
  }

  // assigner_id를 현재 로그인한 사용자로 자동 설정
  // created_by도 현재 사용자로 설정 (프로젝트 구조 제거 후)
  // description이 null이거나 undefined일 때는 객체에서 제거 (스키마 캐시 문제 방지)
  // reference_ids는 tasks 테이블에 없으므로 제거 (별도 task_references에 insert)
  const { reference_ids: _refIds, ...taskWithoutRefs } = task;
  const built = {
    ...taskWithoutRefs,
    assigner_id: currentUserId,
    is_self_task: false, // 명시적으로 false 설정
    created_by: currentUserId,
  } as Record<string, unknown>;
  delete built.project_id;
  delete built.description;
  delete built.reference_ids;
  const taskWithAssigner = built as TaskInsert;

  const { data, error } = await supabase
    .from("tasks")
    .insert(taskWithAssigner)
    .select()
    .single();

  if (error) {
    throw new Error(`업무 생성 실패: ${error.message}`);
  }

  // 참조자 추가 (bulk insert)
  if (referenceIds.length > 0) {
    const referenceRows = referenceIds.map((userId) => ({
      task_id: data.id,
      user_id: userId,
    }));

    const { error: refError } = await supabase
      .from("task_references")
      .insert(referenceRows);

    if (refError) {
      console.error("참조자 추가 실패:", refError);
      throw new Error(`Task는 생성되었으나 참조자 추가에 실패했습니다: ${refError.message}`);
    }
  }

  return data;
}

/**
 * Task 수정 (지시자만 가능)
 * - 지시자(assigner)만 Task 수정 가능
 * - 허용 필드: title, description, due_date만 수정 가능
 * - assigner_id, assignee_id, task_status는 수정 불가
 */
export async function updateTask(id: string, updates: TaskUpdate): Promise<Task> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("인증이 필요합니다.");
  }

  const userId = session.session.user.id;

  // 관리자 권한 확인
  const isAdmin = await checkAdminPermission();

  // 현재 Task 조회 (존재 여부 및 권한 확인)
  const { data: task, error: fetchError } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !task) {
    throw new Error(`Task를 찾을 수 없습니다: ${fetchError?.message || "알 수 없는 오류"}`);
  }

  // 참조자 목록 조회 (참조자 권한 확인용)
  const { data: referenceData, error: refError } = await supabase
    .from("task_references")
    .select("user_id")
    .eq("task_id", id);

  if (refError) {
    console.error("참조자 조회 실패:", refError);
    // 참조자 조회 실패해도 계속 진행 (기존 동작 유지)
  }

  const referenceIds = referenceData?.map((ref) => ref.user_id) || [];
  const isReference = referenceIds.includes(userId);

  // 관리자가 아닌 경우: 역할별 권한 검증
  if (!isAdmin) {
    // 참조자는 오직 send_email_to_client 필드만 수정 가능
    // (참조자이면서 담당자나 지시자가 아닌 경우)
    if (isReference && task.assignee_id !== userId && task.assigner_id !== userId) {
      // 참조자가 send_email_to_client 외의 필드를 수정하려고 하면 차단
      const hasOtherFields = 
        updates.title !== undefined ||
        updates.client_name !== undefined ||
        updates.due_date !== undefined;
      
      if (hasOtherFields) {
        throw new Error("참조자는 오직 '전송완료/미전송' 상태만 수정할 수 있습니다.");
      }
      
      // 참조자가 send_email_to_client를 수정하는 경우만 허용
      if (updates.send_email_to_client === undefined) {
        throw new Error("참조자는 오직 '전송완료/미전송' 상태만 수정할 수 있습니다.");
      }
    }
    
    // send_email_to_client 필드는 담당자(assignee) 또는 참조자만 변경 가능
    if (updates.send_email_to_client !== undefined) {
      if (task.assignee_id !== userId && !isReference) {
        throw new Error("고객에게 이메일 발송 완료 상태는 담당자 또는 참조자만 변경할 수 있습니다.");
      }
    }
    
    // send_email_to_client 외의 필드는 지시자(assigner)만 수정 가능
    const hasGeneralFields = 
      updates.title !== undefined ||
      updates.client_name !== undefined ||
      updates.due_date !== undefined;
    
    if (hasGeneralFields && task.assigner_id !== userId) {
      throw new Error("업무 수정은 지시자만 가능합니다.");
    }
  }

  // 수정 불가 필드 차단
  if (updates.assigner_id !== undefined || updates.assignee_id !== undefined) {
    throw new Error("지시자(assigner)와 담당자(assignee)는 수정할 수 없습니다.");
  }

  if (updates.task_status !== undefined) {
    throw new Error("업무 상태는 수정할 수 없습니다. 상태 변경은 별도의 워크플로우를 사용하세요.");
  }

  // 허용된 필드만 명시적으로 포함 (whitelist 방식)
  const allowedUpdates: Partial<TaskUpdate> = {};
  
  // 관리자: title, client_name, due_date, send_email_to_client 수정 가능
  // 지시자: title, client_name, due_date 수정 가능
  // 담당자: send_email_to_client 수정 가능
  // 참조자: send_email_to_client 수정 가능 (업무에 참조자가 포함된 경우)
  const canEditGeneralFields = isAdmin || task.assigner_id === userId;
  const canEditSendEmail = isAdmin || task.assignee_id === userId || isReference;
  
  // title 수정 허용 (관리자 또는 지시자)
  if (updates.title !== undefined && updates.title !== null) {
    if (!canEditGeneralFields) {
      throw new Error("Task 제목 수정은 지시자 또는 관리자만 가능합니다.");
    }
    allowedUpdates.title = updates.title;
  }
  
  // client_name 수정 허용 (관리자 또는 지시자)
  if (updates.client_name !== undefined && updates.client_name !== null) {
    if (!canEditGeneralFields) {
      throw new Error("고객명 수정은 지시자 또는 관리자만 가능합니다.");
    }
    allowedUpdates.client_name = updates.client_name;
  }
  
  // due_date 수정 허용 (관리자 또는 지시자)
  if (updates.due_date !== undefined) {
    if (!canEditGeneralFields) {
      throw new Error("마감일 수정은 지시자 또는 관리자만 가능합니다.");
    }
    allowedUpdates.due_date = updates.due_date;
  }
  
  // send_email_to_client 수정 허용 (관리자 또는 담당자 또는 참조자)
  if (updates.send_email_to_client !== undefined) {
    if (!canEditSendEmail) {
      throw new Error("고객에게 이메일 발송 완료 상태는 담당자, 참조자 또는 관리자만 변경할 수 있습니다.");
    }
    allowedUpdates.send_email_to_client = updates.send_email_to_client;
  }
  
  // assigner_id, assignee_id, task_status는 이미 위에서 차단됨
  // 다른 필드는 명시적으로 허용하지 않음
  
  // 업데이트할 필드가 없으면 에러
  if (Object.keys(allowedUpdates).length === 0) {
    throw new Error("수정할 내용이 없습니다.");
  }

  // 상태 업데이트
  const { data: updatedTask, error: updateError } = await supabase
    .from("tasks")
    .update(allowedUpdates)
    .eq("id", id)
    .select()
    .single();

  // 에러 상세 로깅
  if (updateError) {
    console.error("[updateTask] Update error:", updateError);
    console.error("[updateTask] Error code:", updateError.code);
    console.error("[updateTask] Error message:", updateError.message);
    console.error("[updateTask] Error details:", updateError.details);
    console.error("[updateTask] Error hint:", updateError.hint);
    throw new Error(`업무 수정 실패: ${updateError.message} (코드: ${updateError.code})`);
  }

  if (!updatedTask) {
    throw new Error("업무 수정 후 데이터를 받지 못했습니다.");
  }

  return updatedTask;
}

/**
 * Task 삭제 (지시자만 가능)
 */
export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", id);

  if (error) {
    throw new Error(`업무 삭제 실패: ${error.message}`);
  }
}

/**
 * 여러 Task에 대한 참조자 목록 일괄 조회
 */
async function fetchReferencesForTasks(
  taskIds: string[],
): Promise<Map<string, Array<{ id: string; full_name: string | null; email: string; avatar_url: string | null }>>> {
  if (taskIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("task_references")
    .select("task_id, profiles(id, full_name, email, avatar_url)")
    .in("task_id", taskIds);

  if (error) {
    console.error("참조자 일괄 조회 실패:", error);
    return new Map();
  }

  type RefRow = { task_id: string; profiles: { id: string; full_name: string | null; email: string; avatar_url: string | null } | null };
  const map = new Map<string, Array<{ id: string; full_name: string | null; email: string; avatar_url: string | null }>>();
  for (const row of (data || []) as RefRow[]) {
    const ref = row.profiles;
    if (!ref?.id) continue;
    const list = map.get(row.task_id) || [];
    list.push(ref);
    map.set(row.task_id, list);
  }
  return map;
}

/**
 * 멤버용 Task 목록 조회
 * 현재 사용자가 담당자 또는 지시자인 Task만 조회
 * 모든 프로젝트에서 Task 조회 (프로젝트별이 아님)
 * 자기 할당 Task는 제외됨
 *
 * @param excludeApproved APPROVED 상태 Task 제외 여부 (기본값: true)
 * @returns TaskWithProfiles[]
 */
export async function getTasksForMember(
  excludeApproved: boolean = true,
): Promise<TaskWithProfiles[]> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("인증이 필요합니다.");
  }

  const userId = session.session.user.id;

  let query = supabase
    .from("tasks")
    .select(`
      *,
      assigner:profiles!tasks_assigner_id_fkey(id, full_name, email, avatar_url),
      assignee:profiles!tasks_assignee_id_fkey(id, full_name, email, avatar_url)
    `)
    .or(`assigner_id.eq.${userId},assignee_id.eq.${userId}`)
    .eq("is_self_task", false); // 자기 할당 Task 제외

  // APPROVED 제외 옵션
  if (excludeApproved) {
    query = query.neq("task_status", "APPROVED");
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Task 목록 조회 실패: ${error.message}`);
  }

  const tasks = (data || []) as TaskWithProfiles[];

  if (tasks.length > 0) {
    const taskIds = tasks.map((task) => task.id);
    // 참조자 일괄 조회 (동일 Task 표시 일관성)
    const refMap = await fetchReferencesForTasks(taskIds);
    tasks.forEach((task) => {
      task.references = refMap.get(task.id) || [];
    });
    // 읽지 않은 메시지 수 배치 조회
    try {
      const unreadCounts = await getUnreadMessageCounts(taskIds, userId);
      tasks.forEach((task) => {
        task.unread_message_count = unreadCounts.get(task.id) || 0;
      });
    } catch (error) {
      console.error("읽지 않은 메시지 수 조회 실패:", error);
      tasks.forEach((task) => {
        task.unread_message_count = 0;
      });
    }
  }

  return tasks;
}

/**
 * Admin용 Task 목록 조회
 * 모든 Task 조회 (APPROVED 제외 옵션)
 * 자기 할당 Task는 제외됨
 * 
 * @param excludeApproved APPROVED 상태 Task 제외 여부 (기본값: true)
 * @returns TaskWithProfiles[]
 */
export async function getTasksForAdmin(
  excludeApproved: boolean = true,
): Promise<TaskWithProfiles[]> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("인증이 필요합니다.");
  }

  // Admin 권한 확인
  const userId = session.session.user.id;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profile?.role !== "admin") {
    throw new Error("Admin 권한이 필요합니다.");
  }

  let query = supabase
    .from("tasks")
    .select(`
      *,
      assigner:profiles!tasks_assigner_id_fkey(id, full_name, email, avatar_url),
      assignee:profiles!tasks_assignee_id_fkey(id, full_name, email, avatar_url)
    `)
    .eq("is_self_task", false); // 자기 할당 Task 제외

  // APPROVED 제외 옵션
  if (excludeApproved) {
    query = query.neq("task_status", "APPROVED");
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Task 목록 조회 실패: ${error.message}`);
  }

  const tasks = (data || []) as TaskWithProfiles[];

  if (tasks.length > 0) {
    const taskIds = tasks.map((task) => task.id);
    const refMap = await fetchReferencesForTasks(taskIds);
    tasks.forEach((task) => {
      task.references = refMap.get(task.id) || [];
    });
    try {
      const unreadCounts = await getUnreadMessageCounts(taskIds, userId);
      tasks.forEach((task) => {
        task.unread_message_count = unreadCounts.get(task.id) || 0;
      });
    } catch (error) {
      console.error("읽지 않은 메시지 수 조회 실패:", error);
      tasks.forEach((task) => {
        task.unread_message_count = 0;
      });
    }
  }

  return tasks;
}

/**
 * 자기 할당 Task 목록 조회
 * 자기 자신에게 할당한 Task만 조회
 * 
 * @param excludeApproved APPROVED 상태 Task 제외 여부 (기본값: false)
 * @returns TaskWithProfiles[]
 */
export async function getSelfTasks(
  excludeApproved: boolean = false,
): Promise<TaskWithProfiles[]> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("인증이 필요합니다.");
  }

  const userId = session.session.user.id;

  let query = supabase
    .from("tasks")
    .select(`
      *,
      assigner:profiles!tasks_assigner_id_fkey(id, full_name, email, avatar_url),
      assignee:profiles!tasks_assignee_id_fkey(id, full_name, email, avatar_url)
    `)
    .eq("is_self_task", true)
    .eq("assigner_id", userId);

  // APPROVED 제외 옵션
  if (excludeApproved) {
    query = query.neq("task_status", "APPROVED");
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    throw new Error(`자기 할당 Task 목록 조회 실패: ${error.message}`);
  }

  const tasks = (data || []) as TaskWithProfiles[];

  // 읽지 않은 메시지 수 배치 조회
  if (tasks.length > 0) {
    const taskIds = tasks.map((task) => task.id);
    try {
      const unreadCounts = await getUnreadMessageCounts(taskIds, userId);
      // 각 Task에 읽지 않은 메시지 수 추가
      tasks.forEach((task) => {
        task.unread_message_count = unreadCounts.get(task.id) || 0;
      });
    } catch (error) {
      // 읽지 않은 메시지 수 조회 실패 시 기본값 0 설정
      console.error("읽지 않은 메시지 수 조회 실패:", error);
      tasks.forEach((task) => {
        task.unread_message_count = 0;
      });
    }
  }

  return tasks;
}

/**
 * Task 상태 변경
 * - assignee: ASSIGNED → IN_PROGRESS, IN_PROGRESS → WAITING_CONFIRM만 가능
 * - assigner: WAITING_CONFIRM → APPROVED/REJECTED만 가능
 * - 자기 할당 Task: IN_PROGRESS → APPROVED 직접 전환 허용
 * - Admin이 assigner/assignee인 경우에도 상태 변경 가능
 */
export async function updateTaskStatus(
  taskId: string,
  newStatus: TaskStatus,
): Promise<Task> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("인증이 필요합니다.");
  }

  const userId = session.session.user.id;

  // 현재 Task 조회
  // 주의: RLS SELECT 정책으로 인해 조회가 실패할 수 있으나,
  // UPDATE 정책(assigner/assignee만 가능)은 별도로 작동하므로 UPDATE는 시도함
  const { data: task, error: fetchError } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .maybeSingle();

  // Task 조회 실패 시에도 UPDATE는 시도 (UPDATE 정책이 별도로 검증)
  // 단, 조회 성공 시 추가 검증 수행
  if (task) {
    // 현재 상태와 새 상태가 같은지 확인
    if (task.task_status === newStatus) {
      throw new Error("이미 해당 상태입니다.");
    }

    // 자기 할당 Task의 경우: IN_PROGRESS → APPROVED 직접 전환 허용
    if (task.is_self_task === true) {
      if (task.task_status === "IN_PROGRESS" && newStatus === "APPROVED") {
        // 자기 할당 Task는 본인만 상태 변경 가능
        if (task.assigner_id !== userId) {
          throw new Error("자기 할당 업무는 본인만 상태를 변경할 수 있습니다.");
        }
        // 직접 전환 허용 (검증 통과)
      } else {
        // 다른 상태 전환은 일반 Task와 동일하게 검증
        if (!isValidStatusTransition(task.task_status, newStatus)) {
          throw new Error(
            getStatusTransitionErrorMessage(task.task_status, newStatus),
          );
        }
      }
    } else {
      // 일반 Task: 기존 검증 로직 유지
      // 상태 전환 유효성 검증
      if (!isValidStatusTransition(task.task_status, newStatus)) {
        throw new Error(
          getStatusTransitionErrorMessage(task.task_status, newStatus),
        );
      }
    }

    // 사용자 역할 확인
    const isAssigner = task.assigner_id === userId;
    const isAssignee = task.assignee_id === userId;

    if (!isAssigner && !isAssignee) {
      throw new Error("이 Task의 지시자 또는 담당자만 상태를 변경할 수 있습니다.");
    }

    // 자기 할당 Task가 아닌 경우에만 역할별 권한 검증
    if (!task.is_self_task) {
      // 역할별 권한 검증
      const userRole = isAssignee ? "assignee" : "assigner";
      if (!canUserChangeStatus(userRole, task.task_status, newStatus)) {
        throw new Error(
          getStatusTransitionErrorMessage(task.task_status, newStatus, userRole),
        );
      }
    }
  } else if (fetchError && fetchError.code !== "PGRST116") {
    // PGRST116이 아닌 다른 에러는 즉시 실패
    throw new Error(`Task 조회 실패: ${fetchError.message}`);
  }
  // PGRST116 에러(RLS로 인한 조회 실패)는 무시하고 UPDATE 시도
  // UPDATE 정책이 assigner/assignee만 허용하므로 안전함

  // 상태 업데이트
  // 주의: UPDATE 후 SELECT 시 RLS 정책으로 인해 0 rows가 반환될 수 있으므로
  // .maybeSingle()을 사용하여 null을 허용하고, 실패 시 기존 task 데이터를 기반으로 반환
  
  // 참고: 채팅 로그는 이제 파일 업로드 기반으로 자동 생성됨 (트리거 기반)
  // 상태 변경 시 로그 생성 로직은 제거됨

  const { data: updatedTask, error: updateError } = await supabase
    .from("tasks")
    .update({ task_status: newStatus })
    .eq("id", taskId)
    .select()
    .maybeSingle();

  if (updateError) {
    // RLS 정책 차단 시 더 명확한 에러 메시지 제공
    if (updateError.code === "42501" || updateError.message.includes("permission denied") || updateError.message.includes("policy")) {
      throw new Error("상태 변경 권한이 없습니다. 이 업무의 지시자 또는 담당자만 상태를 변경할 수 있습니다.");
    }
    // 기타 에러는 원본 메시지 사용
    throw new Error(`상태 변경 실패: ${updateError.message}${updateError.code ? ` (코드: ${updateError.code})` : ""}`);
  }

  // RLS 정책으로 인해 SELECT 결과가 null일 수 있음
  // UPDATE는 성공했으므로 기존 task 데이터를 기반으로 업데이트된 상태 반환
  if (!updatedTask) {
    if (!task) {
      // Task 조회도 실패했지만 UPDATE는 성공했으므로, 최소한의 Task 객체 반환
      // UPDATE 정책이 통과했다는 것은 Task가 존재하고 사용자가 권한이 있다는 의미
      throw new Error("상태 변경은 성공했으나 결과를 조회할 수 없습니다. 페이지를 새로고침해주세요.");
    }
    return { ...task, task_status: newStatus } as Task;
  }

  return updatedTask;
}

/**
 * Edge Function을 통해 마감일 초과 여부 확인
 * Task 생성 후 일정이 마감일을 초과했는지 확인
 * 
 * @param taskId 생성된 Task의 ID
 * @param dueDate Task의 마감일 (YYYY-MM-DD 형식 문자열)
 * @returns 마감일 초과 여부 및 관련 정보
 */
export async function checkDueDateExceeded(
  taskId: string,
  dueDate: string | null | undefined
): Promise<{
  exceeded: boolean;
  scheduleDate?: string;
  dueDate: string;
  reason?: string;
}> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("인증이 필요합니다.");
  }

  // due_date가 없으면 체크하지 않음
  if (!dueDate) {
    return {
      exceeded: false,
      dueDate: "",
      reason: "no_due_date",
    };
  }

  const { data, error } = await supabase.functions.invoke(
    "check-due-date-exceeded",
    {
      body: {
        taskId,
        dueDate,
      },
    }
  );

  if (error) {
    console.error("[checkDueDateExceeded] Edge Function 에러:", error);
    throw new Error(`마감일 체크 실패: ${error.message}`);
  }

  if (data?.error) {
    console.error("[checkDueDateExceeded] 응답 에러:", data.error);
    throw new Error(data.error);
  }

  return data;
}

/**
 * 참조자인 Task 목록 조회
 * 현재 사용자가 참조자로 등록된 Task 목록을 반환합니다.
 * 
 * @returns {Promise<TaskWithProfiles[]>} 참조된 Task 목록
 */
export async function getTasksAsReference(): Promise<TaskWithProfiles[]> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("인증이 필요합니다.");
  }

  const userId = session.session.user.id;

  // 참조자로 등록된 Task ID 목록 조회
  const { data: referenceData, error: refError } = await supabase
    .from("task_references")
    .select("task_id")
    .eq("user_id", userId);

  if (refError) {
    throw new Error(`참조된 Task 조회 실패: ${refError.message}`);
  }

  // 참조된 Task가 없으면 빈 배열 반환
  if (!referenceData || referenceData.length === 0) {
    return [];
  }

  const taskIds = referenceData.map((ref) => ref.task_id);

  // Task 목록 조회 (프로필 정보 포함)
  const { data: tasksData, error: tasksError } = await supabase
    .from("tasks")
    .select(`
      *,
      assigner:profiles!tasks_assigner_id_fkey(id, full_name, email, avatar_url),
      assignee:profiles!tasks_assignee_id_fkey(id, full_name, email, avatar_url)
    `)
    .in("id", taskIds)
    .order("created_at", { ascending: false });

  if (tasksError) {
    throw new Error(`Task 목록 조회 실패: ${tasksError.message}`);
  }

  if (!tasksData) {
    return [];
  }

  // 참조자 일괄 조회 (동일 Task 표시 일관성)
  const idsForRef = tasksData.map((task) => task.id);
  const refMap = await fetchReferencesForTasks(idsForRef);

  // 미읽음 메시지 수 조회
  const unreadCounts = await getUnreadMessageCounts(idsForRef, userId);

  const tasksWithUnread: TaskWithProfiles[] = tasksData.map((task) => ({
    ...task,
    references: refMap.get(task.id) || [],
    unread_message_count: unreadCounts.get(task.id) || 0,
  }));

  return tasksWithUnread;
}

