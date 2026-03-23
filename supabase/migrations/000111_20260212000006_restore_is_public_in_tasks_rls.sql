-- ============================================================================
-- tasks RLS 정책 수정: is_public 조건 복구 및 알림 수신자 접근 허용
-- ============================================================================
-- 목적: 참조자 마이그레이션(20260212000003) 시 누락된 is_public 조건 복구
--       - 공개 Task(is_public=true): 모든 인증 사용자 접근
--       - 알림 수신자: 해당 알림의 task 기본 정보 조회 가능
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. tasks SELECT 정책 재정의 (is_public 복구)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "tasks_select_assigner_assignee_reference_or_admin" ON public.tasks;

CREATE POLICY "tasks_select_assigner_assignee_reference_or_admin"
ON public.tasks
FOR SELECT
USING (
  -- 공개 Task: 모든 인증된 사용자 접근 가능 (자기 할당 제외)
  (is_public = true AND is_self_task = false)
  OR
  -- 자기 할당 Task: 본인만 접근 가능
  (is_self_task = true AND auth.uid() = assigner_id)
  OR
  -- 비공개 Task: admin, assigner, assignee, reference만
  (is_self_task = false AND is_public = false AND (
    is_admin((SELECT auth.uid()))
    OR (SELECT auth.uid()) = assigner_id
    OR (SELECT auth.uid()) = assignee_id
    OR EXISTS (
      SELECT 1 FROM public.task_references
      WHERE task_references.task_id = tasks.id
      AND task_references.user_id = (SELECT auth.uid())
    )
  ))
);

COMMENT ON POLICY "tasks_select_assigner_assignee_reference_or_admin" ON public.tasks IS
'Task 조회 정책: 공개 Task는 모든 사용자, 자기 할당은 본인만, 비공개는 admin/지시자/담당자/참조자만. is_public 복구 적용.';

-- ----------------------------------------------------------------------------
-- 2. 알림 수신자용 tasks SELECT 정책 추가
-- ----------------------------------------------------------------------------
-- 알림이 있는 task의 기본 정보(id, title, task_status, client_name)를
-- 알림 목록 표시 시 JOIN으로 가져올 수 있도록 허용
CREATE POLICY "tasks_select_own_notification_tasks"
ON public.tasks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.notifications
    WHERE notifications.task_id = tasks.id
    AND notifications.user_id = auth.uid()
  )
);

COMMENT ON POLICY "tasks_select_own_notification_tasks" ON public.tasks IS
'알림 수신자가 해당 알림의 task 기본 정보를 조회 가능. notifications 테이블과 JOIN 시 알림 목록 표시를 위해 필요.';
