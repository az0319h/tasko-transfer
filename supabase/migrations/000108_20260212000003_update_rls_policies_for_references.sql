-- ============================================================================
-- Phase 2: RLS 정책 수정 - 참조자 조건 추가
-- ============================================================================
-- 목적: messages, tasks, task_list_items, task_chat_logs, task_chat_log_items, 
--       remove_task_from_lists_on_unpublish 함수에 참조자 조건 추가
-- 
-- 변경 사항:
-- 1. messages SELECT: 참조자도 메시지 조회 가능
-- 2. messages INSERT: 참조자도 메시지 작성 가능
-- 3. tasks SELECT: 참조자도 Task 상세 조회 가능
-- 4. task_list_items INSERT: 참조자인 Task도 목록에 추가 가능
-- 5. task_chat_logs SELECT: 참조자도 채팅 로그 조회 가능
-- 6. task_chat_log_items SELECT: 참조자도 채팅 로그 아이템 조회 가능
-- 7. remove_task_from_lists_on_unpublish: 참조자가 만든 목록에서 제거 여부 정의
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. messages SELECT 정책 수정 (2-1)
-- ----------------------------------------------------------------------------
-- 비공개 Task 조건에 task_references 존재 확인 추가

DROP POLICY IF EXISTS "messages_select_assigner_assignee_or_admin" ON public.messages;

CREATE POLICY "messages_select_assigner_assignee_reference_or_admin"
ON public.messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = messages.task_id
    AND (
      -- Admin은 모든 task의 메시지 조회 가능
      is_admin((SELECT auth.uid()))
      -- Member는 지시자 또는 담당자인 task의 메시지만 조회 가능
      OR tasks.assigner_id = (SELECT auth.uid())
      OR tasks.assignee_id = (SELECT auth.uid())
      -- 참조자도 해당 Task의 메시지 조회 가능
      OR EXISTS (
        SELECT 1 FROM public.task_references
        WHERE task_references.task_id = tasks.id
        AND task_references.user_id = (SELECT auth.uid())
      )
    )
  )
);

COMMENT ON POLICY "messages_select_assigner_assignee_reference_or_admin" ON public.messages IS 
'메시지 조회 정책: Admin 또는 지시자/담당자/참조자만 메시지 조회 가능. Task SELECT 정책과 일치.';

-- ----------------------------------------------------------------------------
-- 2. messages INSERT 정책 수정 (2-2)
-- ----------------------------------------------------------------------------
-- 참조자도 메시지 작성 가능

DROP POLICY IF EXISTS "messages_insert_assigner_or_assignee_only" ON public.messages;

CREATE POLICY "messages_insert_assigner_assignee_or_reference"
ON public.messages
FOR INSERT
WITH CHECK (
  -- Task가 존재하는지 확인
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = messages.task_id
  )
  -- 지시자, 담당자, 참조자만 작성 가능 (Admin도 지시자/담당자/참조자가 아니면 불가)
  AND EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = messages.task_id
    AND (
      tasks.assigner_id = auth.uid() 
      OR tasks.assignee_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.task_references
        WHERE task_references.task_id = tasks.id
        AND task_references.user_id = auth.uid()
      )
    )
  )
  -- 본인 메시지만 생성 가능
  AND auth.uid() = user_id
);

COMMENT ON POLICY "messages_insert_assigner_assignee_or_reference" ON public.messages IS 
'메시지 작성 정책: 지시자, 담당자, 참조자만 메시지 작성 가능. Admin도 지시자/담당자/참조자가 아니면 작성 불가.';

-- ----------------------------------------------------------------------------
-- 3. tasks SELECT 정책 수정 (2-3)
-- ----------------------------------------------------------------------------
-- 참조자도 Task 상세 조회 가능

DROP POLICY IF EXISTS "tasks_select_assigner_assignee_or_admin" ON public.tasks;

CREATE POLICY "tasks_select_assigner_assignee_reference_or_admin"
ON public.tasks
FOR SELECT
USING (
  -- Admin은 모든 task 접근 가능
  is_admin((SELECT auth.uid()))
  -- Member는 지시자 또는 담당자인 task만 접근 가능
  OR (SELECT auth.uid()) = assigner_id
  OR (SELECT auth.uid()) = assignee_id
  -- 참조자도 해당 Task 접근 가능
  OR EXISTS (
    SELECT 1 FROM public.task_references
    WHERE task_references.task_id = tasks.id
    AND task_references.user_id = (SELECT auth.uid())
  )
);

COMMENT ON POLICY "tasks_select_assigner_assignee_reference_or_admin" ON public.tasks IS 
'Task 조회 정책: Admin 또는 지시자/담당자/참조자만 task 접근 가능. Member는 자신이 지시자, 담당자 또는 참조자인 task만 접근 가능.';

-- ----------------------------------------------------------------------------
-- 4. task_list_items INSERT 정책 수정 (2-4)
-- ----------------------------------------------------------------------------
-- 참조자인 Task도 목록에 추가 가능

DROP POLICY IF EXISTS "task_list_items_insert_task_access" ON public.task_list_items;

CREATE POLICY "task_list_items_insert_task_access_with_references"
ON public.task_list_items
FOR INSERT
WITH CHECK (
  -- Task가 공개 상태이거나
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = task_list_items.task_id
    AND tasks.is_public = true
  )
  -- 지시자, 담당자, 참조자 중 하나인 경우
  OR EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = task_list_items.task_id
    AND (
      auth.uid() = tasks.assigner_id
      OR auth.uid() = tasks.assignee_id
      OR EXISTS (
        SELECT 1 FROM public.task_references
        WHERE task_references.task_id = tasks.id
        AND task_references.user_id = auth.uid()
      )
    )
  )
);

COMMENT ON POLICY "task_list_items_insert_task_access_with_references" ON public.task_list_items IS 
'Task 목록 아이템 추가 정책: 공개 Task 또는 지시자/담당자/참조자인 Task를 목록에 추가 가능.';

-- ----------------------------------------------------------------------------
-- 5. task_chat_logs SELECT 정책 수정 (2-5)
-- ----------------------------------------------------------------------------
-- 비공개 Task 조건에 참조자 포함

DROP POLICY IF EXISTS "task_chat_logs_select_task_access" ON public.task_chat_logs;

CREATE POLICY "task_chat_logs_select_task_access_with_references"
ON public.task_chat_logs
FOR SELECT
USING (
  -- Task가 공개 상태이거나
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = task_chat_logs.task_id
    AND tasks.is_public = true
  )
  -- Admin은 모든 채팅 로그 조회 가능
  OR is_admin((SELECT auth.uid()))
  -- 지시자, 담당자, 참조자 중 하나인 경우
  OR EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = task_chat_logs.task_id
    AND (
      auth.uid() = tasks.assigner_id
      OR auth.uid() = tasks.assignee_id
      OR EXISTS (
        SELECT 1 FROM public.task_references
        WHERE task_references.task_id = tasks.id
        AND task_references.user_id = auth.uid()
      )
    )
  )
);

COMMENT ON POLICY "task_chat_logs_select_task_access_with_references" ON public.task_chat_logs IS 
'채팅 로그 조회 정책: 공개 Task, Admin, 지시자/담당자/참조자만 채팅 로그 조회 가능.';

-- ----------------------------------------------------------------------------
-- 6. task_chat_log_items SELECT 정책 수정 (2-6)
-- ----------------------------------------------------------------------------
-- task_chat_logs와 동일. 참조자도 채팅 로그 아이템 조회 가능

DROP POLICY IF EXISTS "task_chat_log_items_select_task_access" ON public.task_chat_log_items;

CREATE POLICY "task_chat_log_items_select_task_access_with_references"
ON public.task_chat_log_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.task_chat_logs
    JOIN public.tasks ON tasks.id = task_chat_logs.task_id
    WHERE task_chat_logs.id = task_chat_log_items.chat_log_id
    AND (
      -- Task가 공개 상태이거나
      tasks.is_public = true
      -- Admin은 모든 채팅 로그 아이템 조회 가능
      OR is_admin((SELECT auth.uid()))
      -- 지시자, 담당자, 참조자 중 하나인 경우
      OR auth.uid() = tasks.assigner_id
      OR auth.uid() = tasks.assignee_id
      OR EXISTS (
        SELECT 1 FROM public.task_references
        WHERE task_references.task_id = tasks.id
        AND task_references.user_id = auth.uid()
      )
    )
  )
);

COMMENT ON POLICY "task_chat_log_items_select_task_access_with_references" ON public.task_chat_log_items IS 
'채팅 로그 아이템 조회 정책: 공개 Task, Admin, 지시자/담당자/참조자만 채팅 로그 아이템 조회 가능. task_chat_logs SELECT 정책과 일치.';

-- ----------------------------------------------------------------------------
-- 7. remove_task_from_lists_on_unpublish 함수 수정 (2-7)
-- ----------------------------------------------------------------------------
-- 비공개 전환 시 참조자가 만든 목록에서 제거할지 여부 정의
-- 기본 정책: 참조자가 만든 목록도 유지 (제거하지 않음)

-- 기존 함수 확인 및 수정
CREATE OR REPLACE FUNCTION public.remove_task_from_lists_on_unpublish()
RETURNS TRIGGER AS $$
BEGIN
  -- is_public이 true에서 false로 변경된 경우
  IF OLD.is_public = true AND NEW.is_public = false THEN
    -- 지시자, 담당자, 참조자가 아닌 사용자의 목록에서 해당 Task 제거
    DELETE FROM public.task_list_items
    WHERE task_id = NEW.id
    AND list_id IN (
      SELECT id FROM public.task_lists
      WHERE user_id NOT IN (NEW.assigner_id, NEW.assignee_id)
      AND user_id NOT IN (
        SELECT user_id FROM public.task_references
        WHERE task_id = NEW.id
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.remove_task_from_lists_on_unpublish() IS 
'Task가 비공개로 전환될 때, 지시자/담당자/참조자가 아닌 사용자의 목록에서 해당 Task를 제거합니다. 참조자가 만든 목록에서는 제거되지 않습니다.';
