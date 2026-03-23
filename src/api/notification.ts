import supabase from "@/lib/supabase";
import type { Tables, TablesUpdate } from "@/database.type";

export type Notification = Tables<"notifications">;
export type NotificationUpdate = TablesUpdate<"notifications">;
export type NotificationType = "TASK_DUE_DATE_EXCEEDED" | "TASK_DUE_DATE_APPROACHING";

export interface NotificationWithTask extends Notification {
  task?: {
    id: string;
    title: string;
    task_status: string;
    client_name: string | null;
  } | null;
}

export interface GetNotificationsOptions {
  is_read?: boolean;
}

/**
 * 알림 목록 조회 (모든 알림을 한번에 가져옴)
 * task 정보를 JOIN하여 함께 반환 (client_name, title, task_status)
 * @param options 필터 옵션
 * @returns 알림 목록 (최신순)
 */
export async function getNotifications(options: GetNotificationsOptions = {}): Promise<NotificationWithTask[]> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("인증이 필요합니다.");
  }

  const { is_read } = options;

  let query = supabase
    .from("notifications")
    .select(`
      *,
      task:tasks!notifications_task_id_fkey(id, title, task_status, client_name)
    `)
    .order("created_at", { ascending: false });

  // 읽음 상태 필터 적용
  if (is_read !== undefined) {
    query = query.eq("is_read", is_read);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`알림 조회 실패: ${error.message}`);
  }

  return (data || []) as NotificationWithTask[];
}

/**
 * 읽지 않은 알림 수 조회
 * @returns 읽지 않은 알림 수
 */
export async function getUnreadNotificationCount(): Promise<number> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("인증이 필요합니다.");
  }

  const userId = session.session.user.id;

  const { data, error } = await supabase.rpc("get_unread_notification_count", {
    p_user_id: userId,
  });

  if (error) {
    throw new Error(`읽지 않은 알림 수 조회 실패: ${error.message}`);
  }

  return data || 0;
}

/**
 * 알림 읽음 처리
 * @param notificationId 알림 ID
 * @returns 업데이트된 알림
 */
export async function markNotificationAsRead(notificationId: string): Promise<Notification> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("인증이 필요합니다.");
  }

  const { data, error } = await supabase
    .from("notifications")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq("id", notificationId)
    .select()
    .single();

  if (error) {
    throw new Error(`알림 읽음 처리 실패: ${error.message}`);
  }

  return data;
}

/**
 * 모든 알림 읽음 처리
 * @returns 업데이트된 알림 수
 */
export async function markAllNotificationsAsRead(): Promise<number> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("인증이 필요합니다.");
  }

  const userId = session.session.user.id;

  const { data, error } = await supabase
    .from("notifications")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("is_read", false)
    .select();

  if (error) {
    throw new Error(`전체 알림 읽음 처리 실패: ${error.message}`);
  }

  return data?.length || 0;
}

/**
 * 알림 삭제
 * @param notificationId 알림 ID
 */
export async function deleteNotification(notificationId: string): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("인증이 필요합니다.");
  }

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId);

  if (error) {
    throw new Error(`알림 삭제 실패: ${error.message}`);
  }
}
