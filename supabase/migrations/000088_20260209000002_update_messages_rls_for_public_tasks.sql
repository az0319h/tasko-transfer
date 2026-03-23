-- ============================================================================
-- Task 공유 기능 구현 - messages 테이블 RLS 정책 수정
-- ============================================================================
-- 목적: messages 테이블의 RLS 정책을 tasks 테이블과 일치시켜 공개 Task의 메시지도 조회 가능하도록 수정
-- 
-- 작업 내용:
-- 1. messages SELECT 정책 수정 (공개 Task의 메시지 접근 로직 포함)
-- 2. task_chat_logs SELECT 정책 수정 (공개 Task의 채팅 로그 접근 로직 포함)
-- 3. task_chat_log_items SELECT 정책 수정 (공개 Task의 채팅 로그 아이템 접근 로직 포함)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. messages 테이블 SELECT 정책 수정
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "messages_select_participant_or_admin" ON public.messages;
DROP POLICY IF EXISTS "messages_select_task_access" ON public.messages;
DROP POLICY IF EXISTS "messages_select_assigner_assignee_or_admin" ON public.messages;

CREATE POLICY "messages_select_admin_or_assigned_or_public" ON public.messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = messages.task_id
    AND (
      -- 공개된 Task: 모든 인증된 사용자 접근 가능 (자기 할당 Task 제외)
      (tasks.is_public = true AND tasks.is_self_task = false)
      OR
      -- 자기 할당 Task: 본인만 접근 가능 (관리자도 제외, 공개 여부와 무관)
      (tasks.is_self_task = true AND auth.uid() = tasks.assigner_id)
      OR
      -- 일반 비공개 Task: 기존 정책 유지 (관리자 또는 지시자/담당자)
      (tasks.is_self_task = false AND tasks.is_public = false AND (
        is_admin(auth.uid()) OR 
        auth.uid() = tasks.assigner_id OR 
        auth.uid() = tasks.assignee_id
      ))
    )
  )
);

COMMENT ON POLICY "messages_select_admin_or_assigned_or_public" ON public.messages IS 
'메시지 조회 정책: 공개된 Task의 메시지는 모든 인증된 사용자 조회 가능, 자기 할당 Task의 메시지는 본인만 조회 가능, 일반 비공개 Task의 메시지는 관리자 또는 지시자/담당자만 조회 가능';

-- ----------------------------------------------------------------------------
-- 2. task_chat_logs 테이블 SELECT 정책 수정
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "task_chat_logs_select_task_participants" ON public.task_chat_logs;

CREATE POLICY "task_chat_logs_select_admin_or_assigned_or_public" ON public.task_chat_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = task_chat_logs.task_id
    AND (
      -- 공개된 Task: 모든 인증된 사용자 접근 가능 (자기 할당 Task 제외)
      (tasks.is_public = true AND tasks.is_self_task = false)
      OR
      -- 자기 할당 Task: 본인만 접근 가능 (관리자도 제외, 공개 여부와 무관)
      (tasks.is_self_task = true AND auth.uid() = tasks.assigner_id)
      OR
      -- 일반 비공개 Task: 기존 정책 유지 (관리자 또는 지시자/담당자)
      (tasks.is_self_task = false AND tasks.is_public = false AND (
        is_admin(auth.uid()) OR 
        auth.uid() = tasks.assigner_id OR 
        auth.uid() = tasks.assignee_id
      ))
    )
  )
);

COMMENT ON POLICY "task_chat_logs_select_admin_or_assigned_or_public" ON public.task_chat_logs IS 
'채팅 로그 조회 정책: 공개된 Task의 채팅 로그는 모든 인증된 사용자 조회 가능, 자기 할당 Task의 채팅 로그는 본인만 조회 가능, 일반 비공개 Task의 채팅 로그는 관리자 또는 지시자/담당자만 조회 가능';

-- ----------------------------------------------------------------------------
-- 3. task_chat_log_items 테이블 SELECT 정책 수정
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "task_chat_log_items_select_task_participants" ON public.task_chat_log_items;

CREATE POLICY "task_chat_log_items_select_admin_or_assigned_or_public" ON public.task_chat_log_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.task_chat_logs
    JOIN public.tasks ON tasks.id = task_chat_logs.task_id
    WHERE task_chat_log_items.log_id = task_chat_logs.id
    AND (
      -- 공개된 Task: 모든 인증된 사용자 접근 가능 (자기 할당 Task 제외)
      (tasks.is_public = true AND tasks.is_self_task = false)
      OR
      -- 자기 할당 Task: 본인만 접근 가능 (관리자도 제외, 공개 여부와 무관)
      (tasks.is_self_task = true AND auth.uid() = tasks.assigner_id)
      OR
      -- 일반 비공개 Task: 기존 정책 유지 (관리자 또는 지시자/담당자)
      (tasks.is_self_task = false AND tasks.is_public = false AND (
        is_admin(auth.uid()) OR 
        auth.uid() = tasks.assigner_id OR 
        auth.uid() = tasks.assignee_id
      ))
    )
  )
);

COMMENT ON POLICY "task_chat_log_items_select_admin_or_assigned_or_public" ON public.task_chat_log_items IS 
'채팅 로그 아이템 조회 정책: 공개된 Task의 채팅 로그 아이템은 모든 인증된 사용자 조회 가능, 자기 할당 Task의 채팅 로그 아이템은 본인만 조회 가능, 일반 비공개 Task의 채팅 로그 아이템은 관리자 또는 지시자/담당자만 조회 가능';

COMMIT;
