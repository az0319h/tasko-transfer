-- ============================================================================
-- Phase 1: Task 3-1 (추가) - 다른 테이블 RLS 정책 변경
-- ============================================================================
-- 목적: messages, task_chat_logs, task_chat_log_items 테이블의 RLS 정책에서 
--       project_id 의존성 제거
-- 
-- 작업 내용:
-- 1. messages 테이블 RLS 정책 수정
-- 2. task_chat_logs 테이블 RLS 정책 수정
-- 3. task_chat_log_items 테이블 RLS 정책 수정
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. messages 테이블 RLS 정책 수정
-- ----------------------------------------------------------------------------

-- SELECT 정책: 관리자 또는 태스크의 지시자/담당자만 메시지 조회 가능
DROP POLICY IF EXISTS "messages_select_participant_or_admin" ON public.messages;
CREATE POLICY "messages_select_participant_or_admin"
ON public.messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = messages.task_id
    AND (
      is_admin(auth.uid())
      OR auth.uid() = tasks.assigner_id
      OR auth.uid() = tasks.assignee_id
    )
  )
);

COMMENT ON POLICY "messages_select_participant_or_admin" ON public.messages IS 
'메시지 조회 정책: 관리자 또는 태스크의 지시자/담당자만 메시지 조회 가능';

-- ----------------------------------------------------------------------------
-- 2. task_chat_logs 테이블 RLS 정책 수정
-- ----------------------------------------------------------------------------

-- SELECT 정책: 관리자 또는 태스크의 지시자/담당자만 조회 가능
DROP POLICY IF EXISTS "task_chat_logs_select_task_participants" ON public.task_chat_logs;
CREATE POLICY "task_chat_logs_select_task_participants"
ON public.task_chat_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = task_chat_logs.task_id
    AND (
      is_admin(auth.uid())
      OR auth.uid() = tasks.assigner_id
      OR auth.uid() = tasks.assignee_id
    )
  )
);

-- INSERT 정책: 상태 변경 권한자만 가능 (assigner/assignee)
DROP POLICY IF EXISTS "task_chat_logs_insert_status_changer" ON public.task_chat_logs;
CREATE POLICY "task_chat_logs_insert_status_changer"
ON public.task_chat_logs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = task_chat_logs.task_id
    AND (
      tasks.assigner_id = auth.uid()
      OR tasks.assignee_id = auth.uid()
    )
  )
);

COMMENT ON POLICY "task_chat_logs_select_task_participants" ON public.task_chat_logs IS 
'채팅 로그 조회 정책: 관리자 또는 태스크의 지시자/담당자만 조회 가능';

COMMENT ON POLICY "task_chat_logs_insert_status_changer" ON public.task_chat_logs IS 
'채팅 로그 생성 정책: 태스크의 지시자 또는 담당자만 생성 가능';

-- ----------------------------------------------------------------------------
-- 3. task_chat_log_items 테이블 RLS 정책 수정
-- ----------------------------------------------------------------------------

-- SELECT 정책: 관리자 또는 태스크의 지시자/담당자만 조회 가능
DROP POLICY IF EXISTS "task_chat_log_items_select_task_participants" ON public.task_chat_log_items;
CREATE POLICY "task_chat_log_items_select_task_participants"
ON public.task_chat_log_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.task_chat_logs
    JOIN public.tasks ON tasks.id = task_chat_logs.task_id
    WHERE task_chat_log_items.log_id = task_chat_logs.id
    AND (
      is_admin(auth.uid())
      OR auth.uid() = tasks.assigner_id
      OR auth.uid() = tasks.assignee_id
    )
  )
);

-- INSERT 정책: 상태 변경 권한자만 가능 (assigner/assignee)
DROP POLICY IF EXISTS "task_chat_log_items_insert_status_changer" ON public.task_chat_log_items;
CREATE POLICY "task_chat_log_items_insert_status_changer"
ON public.task_chat_log_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.task_chat_logs
    JOIN public.tasks ON tasks.id = task_chat_logs.task_id
    WHERE task_chat_log_items.log_id = task_chat_logs.id
    AND (
      tasks.assigner_id = auth.uid()
      OR tasks.assignee_id = auth.uid()
    )
  )
);

COMMENT ON POLICY "task_chat_log_items_select_task_participants" ON public.task_chat_log_items IS 
'채팅 로그 아이템 조회 정책: 관리자 또는 태스크의 지시자/담당자만 조회 가능';

COMMENT ON POLICY "task_chat_log_items_insert_status_changer" ON public.task_chat_log_items IS 
'채팅 로그 아이템 생성 정책: 태스크의 지시자 또는 담당자만 생성 가능';

COMMIT;
