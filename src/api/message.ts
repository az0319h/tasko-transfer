import supabase from "@/lib/supabase";
import type { Tables, TablesInsert } from "@/database.type";
import type { TaskStatus } from "@/lib/task-status";

export type Message = Tables<"messages"> & {
  read_by?: string[] | null;
  file_url?: string | null;
  file_name?: string | null;
  file_type?: string | null;
  file_size?: number | null;
};

// New chat log types (replacing old message_logs)
import type { Database } from "@/database.type";

export type ChatLogType = Database["public"]["Enums"]["chat_log_type"];

export type ChatLog = Database["public"]["Tables"]["task_chat_logs"]["Row"];

export type ChatLogWithItems = ChatLog & {
  items: Array<{
    id: string;
    log_id: string;
    message_id: string;
    position: number;
    message: MessageWithProfile;
  }>;
  creator: {
    id: string;
    full_name: string | null;
    email: string;
  };
};

// Legacy types (deprecated, will be removed after migration)
export type MessageLog = {
  id: string;
  task_id: string;
  title: string;
  status: TaskStatus;
  system_message_id: string;
  previous_system_message_id: string | null;
  file_count: number;
  text_count: number;
  created_at: string;
  updated_at: string;
};

export type MessageLogWithSystemMessage = MessageLog & {
  system_message: MessageWithProfile;
  previous_system_message: MessageWithProfile | null;
};

export type MessageInsert = Omit<TablesInsert<"messages">, "user_id"> & {
  file_url?: string | null;
  file_name?: string | null;
  file_type?: string | null;
  file_size?: number | null;
};

/**
 * Message with sender profile information
 */
export type MessageWithProfile = Message & {
  sender: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
};

/**
 * Task의 메시지 목록 조회
 * Task 접근 권한이 있으면 해당 Task의 모든 메시지 조회 가능
 * sender 프로필 정보를 JOIN하여 함께 반환
 * 삭제되지 않은 메시지만 조회 (deleted_at IS NULL)
 */
export async function getMessagesByTaskId(taskId: string): Promise<MessageWithProfile[]> {
  const { data, error } = await supabase
    .from("messages")
    .select(`
      *,
      sender:profiles!messages_user_id_fkey(id, full_name, email, avatar_url)
    `)
    .eq("task_id", taskId)
    .is("deleted_at", null) // 삭제되지 않은 메시지만 조회
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`메시지 목록 조회 실패: ${error.message}`);
  }

  return (data || []) as MessageWithProfile[];
}

/**
 * Task의 채팅 로그 목록 조회 (새 시스템)
 * 로그와 참조된 메시지들을 함께 조회
 */
export async function getChatLogsByTaskId(taskId: string): Promise<ChatLogWithItems[]> {
  // 로그 조회 (FK 이름은 Supabase가 자동 생성하므로 직접 지정하지 않음)
  const { data: logs, error: logsError } = await supabase
    .from("task_chat_logs")
    .select(`
      id,
      task_id,
      created_by,
      log_type,
      title,
      created_at
    `)
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (logsError) {
    throw new Error(`채팅 로그 조회 실패: ${logsError.message}`);
  }

  if (!logs || logs.length === 0) {
    return [];
  }

  // 각 로그의 creator 프로필 조회
  const creatorIds = [...new Set(logs.map((log) => log.created_by))];
  const { data: creators, error: creatorsError } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", creatorIds);

  if (creatorsError) {
    throw new Error(`프로필 조회 실패: ${creatorsError.message}`);
  }

  const creatorMap = new Map(
    (creators || []).map((c) => [c.id, { id: c.id, full_name: c.full_name, email: c.email }])
  );

  // 각 로그의 items 조회
  const logsWithItems: ChatLogWithItems[] = await Promise.all(
    logs.map(async (log) => {
      const { data: items, error: itemsError } = await supabase
        .from("task_chat_log_items")
        .select("id, log_id, message_id, position")
        .eq("log_id", log.id)
        .order("position", { ascending: true });

      if (itemsError) {
        throw new Error(`로그 아이템 조회 실패: ${itemsError.message}`);
      }

      if (!items || items.length === 0) {
        return {
          ...log,
          items: [],
          creator: creatorMap.get(log.created_by) || { id: log.created_by, full_name: null, email: "" },
        } as ChatLogWithItems;
      }

      // 메시지 조회
      const messageIds = items.map((item) => item.message_id);
      const { data: messages, error: messagesError } = await supabase
        .from("messages")
        .select(`
          *,
          sender:profiles!messages_user_id_fkey(id, full_name, email, avatar_url)
        `)
        .in("id", messageIds)
        .is("deleted_at", null);

      if (messagesError) {
        throw new Error(`메시지 조회 실패: ${messagesError.message}`);
      }

      const messageMap = new Map((messages || []).map((m) => [m.id, m as MessageWithProfile]));

      return {
        ...log,
        items: items
          .map((item) => ({
            id: item.id,
            log_id: item.log_id,
            message_id: item.message_id,
            position: item.position,
            message: messageMap.get(item.message_id)!,
          }))
          .filter((item) => item.message !== undefined)
          .sort((a, b) => a.position - b.position),
        creator: creatorMap.get(log.created_by) || { id: log.created_by, full_name: null, email: "" },
      } as ChatLogWithItems;
    })
  );

  return logsWithItems;
}

/**
 * Task의 메시지 로그(그룹) 목록 조회 (레거시, deprecated)
 * @deprecated Use getChatLogsByTaskId instead
 * 이 함수는 더 이상 사용되지 않으며, message_logs 테이블이 제거되었습니다.
 */
export async function getMessageLogsByTaskId(taskId: string): Promise<MessageLogWithSystemMessage[]> {
  // 레거시 함수: message_logs 테이블이 제거되어 빈 배열 반환
  // 새로운 시스템에서는 getChatLogsByTaskId를 사용하세요.
  console.warn("getMessageLogsByTaskId is deprecated. Use getChatLogsByTaskId instead.");
  return [];
}

/**
 * 메시지 생성
 * 지시자, 담당자, 참조자만 메시지 작성 가능
 */
export async function createMessage(message: MessageInsert): Promise<Message> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("인증이 필요합니다.");
  }

  const userId = session.session.user.id;

  // Task 조회하여 지시자/담당자 확인
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("assigner_id, assignee_id")
    .eq("id", message.task_id)
    .single();

  if (taskError || !task) {
    throw new Error("업무를 찾을 수 없습니다.");
  }

  // 참조자 여부 확인
  const { data: referenceData, error: refError } = await supabase
    .from("task_references")
    .select("user_id")
    .eq("task_id", message.task_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (refError) {
    console.error("참조자 확인 실패:", refError);
  }

  const isReference = !!referenceData;

  // 지시자, 담당자, 참조자만 작성 가능
  if (userId !== task.assigner_id && userId !== task.assignee_id && !isReference) {
    throw new Error("지시자, 담당자, 참조자만 메시지를 작성할 수 있습니다.");
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      ...message,
      user_id: userId,
      read_by: [], // 초기값: 빈 배열
    })
    .select()
    .single();

  if (error) {
    throw new Error(`메시지 생성 실패: ${error.message}`);
  }

  return data as Message;
}

/**
 * 파일 메시지 생성
 * Supabase Storage에 업로드된 파일의 URL을 포함하여 메시지 생성
 * 지시자, 담당자, 참조자만 메시지 작성 가능
 */
export async function createFileMessage(
  taskId: string,
  fileUrl: string,
  fileName: string,
  fileType: string,
  fileSize: number,
): Promise<Message> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("인증이 필요합니다.");
  }

  const userId = session.session.user.id;

  // Task 조회하여 지시자/담당자/참조자 확인
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("assigner_id, assignee_id")
    .eq("id", taskId)
    .single();

  if (taskError || !task) {
    throw new Error("업무를 찾을 수 없습니다.");
  }

  const { data: referenceData } = await supabase
    .from("task_references")
    .select("user_id")
    .eq("task_id", taskId)
    .eq("user_id", userId)
    .maybeSingle();

  const isReference = !!referenceData;

  // 지시자, 담당자, 참조자만 작성 가능
  if (userId !== task.assigner_id && userId !== task.assignee_id && !isReference) {
    throw new Error("지시자, 담당자, 참조자만 메시지를 작성할 수 있습니다.");
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      task_id: taskId,
      user_id: userId,
      content: fileName, // 파일명을 content로 사용
      message_type: "FILE",
      file_url: fileUrl,
      file_name: fileName,
      file_type: fileType,
      file_size: fileSize,
      read_by: [],
    })
    .select()
    .single();

  if (error) {
    throw new Error(`파일 메시지 생성 실패: ${error.message}`);
  }

  return data as Message;
}

/**
 * 텍스트와 파일을 함께 포함한 메시지 생성
 * 텍스트가 있으면 텍스트 메시지로, 파일이 있으면 파일 메시지로 각각 생성
 * 파일이 포함된 경우 bundle_id를 생성하고, 마지막 파일 메시지에 is_log_anchor=true 설정
 * 지시자, 담당자, 참조자만 메시지 작성 가능
 */
export async function createMessageWithFiles(
  taskId: string,
  content: string | null,
  files: Array<{ url: string; fileName: string; fileType: string; fileSize: number }>,
  bundleId?: string, // Optional: 프론트엔드에서 생성한 bundle_id
): Promise<Message[]> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("인증이 필요합니다.");
  }

  const userId = session.session.user.id;

  // Task 조회하여 지시자/담당자/참조자 확인
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("assigner_id, assignee_id")
    .eq("id", taskId)
    .single();

  if (taskError || !task) {
    throw new Error("업무를 찾을 수 없습니다.");
  }

  const { data: referenceData } = await supabase
    .from("task_references")
    .select("user_id")
    .eq("task_id", taskId)
    .eq("user_id", userId)
    .maybeSingle();

  const isReference = !!referenceData;

  // 지시자, 담당자, 참조자만 작성 가능
  if (userId !== task.assigner_id && userId !== task.assignee_id && !isReference) {
    throw new Error("지시자, 담당자, 참조자만 메시지를 작성할 수 있습니다.");
  }

  // 파일이 포함된 경우 bundle_id 생성 (프론트엔드에서 전달하지 않은 경우)
  // 텍스트만 전송하는 경우 bundle_id는 null (로그 생성 안 됨)
  const hasFiles = files.length > 0;
  const finalBundleId = hasFiles ? (bundleId || crypto.randomUUID()) : null;

  const messages: Message[] = [];

  // 중요: 텍스트 메시지를 먼저 생성 (트리거 실행 시점에 bundle_id로 조회 가능하도록)
  // 파일이 포함된 경우 텍스트 메시지에도 bundle_id 설정
  if (content && content.trim()) {
    const { data: textMessage, error: textError } = await supabase
      .from("messages")
      .insert({
        task_id: taskId,
        user_id: userId,
        content: content.trim(),
        message_type: "USER",
        read_by: [],
        bundle_id: finalBundleId, // 파일이 있으면 같은 bundle_id
        is_log_anchor: false, // 텍스트는 anchor가 될 수 없음
      })
      .select()
      .single();

    if (textError) {
      throw new Error(`텍스트 메시지 생성 실패: ${textError.message}`);
    }
    messages.push(textMessage as Message);
  }

  // 파일 메시지들을 나중에 생성 (마지막 파일 메시지에만 is_log_anchor=true 설정)
  // 마지막 파일 메시지가 insert될 때 트리거가 실행되며, 이 시점에 텍스트 메시지도 이미 DB에 있음
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const isLastFile = i === files.length - 1;
    
    const { data: fileMessage, error: fileError } = await supabase
      .from("messages")
      .insert({
        task_id: taskId,
        user_id: userId,
        content: file.fileName,
        message_type: "FILE",
        file_url: file.url,
        file_name: file.fileName,
        file_type: file.fileType,
        file_size: file.fileSize,
        read_by: [],
        bundle_id: finalBundleId,
        is_log_anchor: isLastFile && hasFiles, // 마지막 파일만 anchor
      })
      .select()
      .single();

    if (fileError) {
      throw new Error(`파일 메시지 생성 실패: ${fileError.message}`);
    }
    messages.push(fileMessage as Message);
  }

  return messages;
}

/**
 * 메시지를 읽음 처리
 * 특정 메시지를 현재 사용자가 읽었다고 표시
 */
export async function markMessageAsRead(messageId: string): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("인증이 필요합니다.");
  }

  const { error } = await supabase.rpc("mark_message_as_read", {
    message_id: messageId,
    reader_id: session.session.user.id,
  });

  if (error) {
    throw new Error(`메시지 읽음 처리 실패: ${error.message}`);
  }
}

/**
 * Task의 모든 메시지를 읽음 처리
 * 채팅 화면 진입 시 호출
 */
export async function markTaskMessagesAsRead(taskId: string): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("인증이 필요합니다.");
  }

  const { error } = await supabase.rpc("mark_task_messages_as_read", {
    task_id_param: taskId,
    reader_id: session.session.user.id,
  });

  if (error) {
    throw new Error(`메시지 읽음 처리 실패: ${error.message}`);
  }
}

/**
 * read_by 값을 안전하게 파싱하여 읽은 인원 수 반환
 * Supabase Json 타입/직렬화 이슈 대응
 */
function getReadByCount(readBy: unknown): number {
  if (Array.isArray(readBy)) {
    return new Set(readBy.filter((v): v is string => typeof v === "string")).size;
  }
  if (readBy != null && typeof readBy === "string") {
    try {
      const parsed = JSON.parse(readBy) as unknown;
      return Array.isArray(parsed)
        ? new Set(parsed.filter((v): v is string => typeof v === "string")).size
        : 0;
    } catch {
      return 0;
    }
  }
  return 0;
}

/**
 * 메시지의 미읽음 인원 수 계산 (동기, 클라이언트)
 * 카카오톡 스타일: 총 참여자(지시자, 담당자, 참조자) - 1(작성자) - read_by.length = 미읽음 수
 * 참조자 포함 모든 참여자의 읽음 상태 반영
 *
 * @param message 메시지 정보 (read_by 포함)
 * @param task Task 정보 (assigner_id, assignee_id, references 포함)
 * @returns 미읽음 인원 수 (0이면 모두 읽음)
 */
export function getUnreadCountForMessageFromData(
  message: { user_id: string; read_by?: unknown },
  task: { assigner_id: string; assignee_id: string | null; references?: Array<{ id?: string; user_id?: string }> }
): number {
  // 실제 참여자 수 (중복 제외: 자기 할당 Task 시 assigner=assignee)
  const participantIds = new Set<string>();
  if (task.assigner_id) participantIds.add(task.assigner_id);
  if (task.assignee_id) participantIds.add(task.assignee_id);
  (task.references ?? []).forEach((ref) => {
    const id = ref?.id ?? ref?.user_id;
    if (id) participantIds.add(id);
  });
  const totalParticipants = participantIds.size;
  if (totalParticipants <= 1) return 0;
  const readCount = getReadByCount(message.read_by);
  const unreadCount = totalParticipants - 1 - readCount; // -1: 작성자(본인)
  return Math.max(0, unreadCount);
}

/**
 * 메시지가 상대방(assigner 또는 assignee)에 의해 읽혔는지 확인
 * 읽음 처리는 지시자(assigner) ↔ 담당자(assignee) 사이에서만 발생
 * @param message 메시지 정보
 * @param currentUserId 현재 사용자 ID
 * @param task Task 정보 (assigner_id, assignee_id 포함)
 * @returns 읽음 여부
 */
export function isMessageReadByCounterpart(
  message: MessageWithProfile,
  currentUserId: string,
  task: { assigner_id: string; assignee_id: string }
): boolean {
  // 본인이 보낸 메시지만 읽음 표시
  if (message.user_id !== currentUserId) {
    return false;
  }

  // 읽음 처리 주체 확인
  const isCurrentUserAssigner = currentUserId === task.assigner_id;
  const isCurrentUserAssignee = currentUserId === task.assignee_id;

  // 읽음 처리 주체가 아닌 경우 false (Admin 제3자 등)
  if (!isCurrentUserAssigner && !isCurrentUserAssignee) {
    return false;
  }

  // 보낸 사람이 assigner/assignee인지 확인
  const isSenderAssigner = message.user_id === task.assigner_id;
  const isSenderAssignee = message.user_id === task.assignee_id;

  // 상대방 ID 확인
  const counterpartId = isSenderAssigner 
    ? task.assignee_id  // 지시자가 보낸 메시지 → 담당자 확인
    : task.assigner_id; // 담당자가 보낸 메시지 → 지시자 확인

  // read_by 배열에 상대방 ID가 있는지 확인
  const readBy = message.read_by || [];
  if (!Array.isArray(readBy)) {
    return false;
  }

  // 타입 안전성: 모든 값을 문자열로 변환하여 비교
  const counterpartIdStr = String(counterpartId);
  return readBy.some((id) => String(id) === counterpartIdStr);
}

/**
 * Task의 읽지 않은 메시지 수 조회 (단일 Task)
 * 현재 사용자가 지시자/담당자인 경우에만 의미 있는 값을 반환
 * @param taskId Task ID
 * @param userId 사용자 ID
 * @returns 읽지 않은 메시지 수
 */
export async function getUnreadMessageCount(taskId: string, userId: string): Promise<number> {
  const { data, error } = await supabase.rpc("get_unread_message_count", {
    p_task_id: taskId,
    p_user_id: userId,
  });

  if (error) {
    console.error("읽지 않은 메시지 수 조회 실패:", error);
    return 0; // 에러 발생 시 기본값 0 반환
  }

  return (data as number) || 0;
}

/**
 * 여러 Task의 읽지 않은 메시지 수 조회 (배치 조회)
 * 현재 사용자가 지시자/담당자인 경우에만 의미 있는 값을 반환
 * @param taskIds Task ID 배열
 * @param userId 사용자 ID
 * @returns Task ID를 키로 하는 Map (taskId → unreadCount)
 */
export async function getUnreadMessageCounts(
  taskIds: string[],
  userId: string
): Promise<Map<string, number>> {
  if (taskIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase.rpc("get_unread_message_counts", {
    p_task_ids: taskIds,
    p_user_id: userId,
  });

  if (error) {
    console.error("읽지 않은 메시지 수 배치 조회 실패:", error);
    return new Map(); // 에러 발생 시 빈 Map 반환
  }

  // 결과를 Map으로 변환
  const countMap = new Map<string, number>();
  if (data && Array.isArray(data)) {
    for (const row of data) {
      countMap.set(row.result_task_id, row.unread_count || 0);
    }
  }

  return countMap;
}

/**
 * 메시지 삭제 (Soft Delete)
 * 본인이 보낸 메시지만 삭제 가능
 * 파일 메시지인 경우 Storage에서도 파일 삭제
 */
export async function deleteMessage(messageId: string): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("인증이 필요합니다.");
  }

  // 메시지 조회 (본인 메시지인지 확인 및 파일 정보 확인)
  const { data: message, error: fetchError } = await supabase
    .from("messages")
    .select("user_id, message_type, file_url, deleted_at")
    .eq("id", messageId)
    .single();

  if (fetchError || !message) {
    throw new Error("메시지를 찾을 수 없습니다.");
  }

  if (message.user_id !== session.session.user.id) {
    throw new Error("본인이 보낸 메시지만 삭제할 수 있습니다.");
  }

  if (message.deleted_at) {
    throw new Error("이미 삭제된 메시지입니다.");
  }

  // Soft delete: deleted_at 설정
  const { error: updateError } = await supabase
    .from("messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", messageId);

  if (updateError) {
    throw new Error(`메시지 삭제 실패: ${updateError.message}`);
  }

  // 파일 메시지인 경우 Storage에서도 파일 삭제
  if (message.message_type === "FILE" && message.file_url) {
    try {
      const { deleteTaskFile } = await import("./storage");
      await deleteTaskFile(message.file_url);
    } catch (error) {
      // Storage 삭제 실패해도 DB 삭제는 완료됨 (로깅만)
      console.error("Storage 파일 삭제 실패:", error);
    }
  }
}

/**
 * 특정 메시지의 미읽음 사용자 수 조회
 * 총 참여자(지시자, 담당자, 참조자) - 1(작성자) - read_by.length = 미읽음 수
 * 
 * @param messageId 메시지 ID
 * @returns 미읽음 사용자 수
 */
export async function getUnreadCountForMessage(messageId: string): Promise<number> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("인증이 필요합니다.");
  }

  // 메시지 조회
  const { data: message, error: messageError } = await supabase
    .from("messages")
    .select("task_id, user_id, read_by")
    .eq("id", messageId)
    .is("deleted_at", null)
    .single();

  if (messageError || !message) {
    return 0;
  }

  // Task 조회 (지시자, 담당자 정보)
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("assigner_id, assignee_id")
    .eq("id", message.task_id)
    .single();

  if (taskError || !task) {
    return 0;
  }

  // 참조자 수 조회
  const { count: referenceCount, error: refError } = await supabase
    .from("task_references")
    .select("*", { count: "exact", head: true })
    .eq("task_id", message.task_id);

  if (refError) {
    console.error("참조자 수 조회 실패:", refError);
  }

  // 총 참여자 수 = 지시자(1) + 담당자(1) + 참조자(n)
  const totalParticipants = 2 + (referenceCount || 0);

  // read_by 배열 길이
  const readCount = Array.isArray(message.read_by) ? message.read_by.length : 0;

  // 미읽음 수 = 총 참여자 - 1(작성자) - 읽은 사람 수
  const unreadCount = totalParticipants - 1 - readCount;

  return Math.max(0, unreadCount); // 음수 방지
}

