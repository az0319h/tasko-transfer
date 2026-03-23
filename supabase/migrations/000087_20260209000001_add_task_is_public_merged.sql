-- ============================================================================
-- Task 공유 기능 구현 - 통합 마이그레이션
-- ============================================================================
-- 목적: Task 공유 기능을 위한 모든 스키마 및 RLS 정책 변경사항을 통합
-- 
-- 작업 내용:
-- Part 1: tasks 테이블에 is_public 컬럼 추가 및 RLS 정책 수정
-- Part 2: messages 테이블 RLS 정책 수정 (공개 Task의 메시지 접근 허용)
-- Part 3: task_list_items RLS 정책 수정 및 자동 제거 트리거 추가
-- ============================================================================

BEGIN;

-- ============================================================================
-- Part 1: tasks 테이블에 is_public 컬럼 추가 및 RLS 정책 수정
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. is_public 컬럼 추가
-- ----------------------------------------------------------------------------

ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tasks.is_public IS 'Task 공개 여부. true일 경우 모든 사용자가 읽기 전용으로 접근 가능';

-- ----------------------------------------------------------------------------
-- 2. is_public 인덱스 추가
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_tasks_is_public 
ON public.tasks(is_public) 
WHERE is_public = true;

COMMENT ON INDEX idx_tasks_is_public IS '공개된 Task 조회 최적화를 위한 부분 인덱스';

-- ----------------------------------------------------------------------------
-- 3. SELECT RLS 정책 수정 - tasks_select_admin_or_assigned
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS tasks_select_admin_or_assigned ON public.tasks;

CREATE POLICY tasks_select_admin_or_assigned ON public.tasks
FOR SELECT
USING (
  -- 공개된 Task: 모든 인증된 사용자 접근 가능 (자기 할당 Task 제외)
  is_public = true
  OR
  -- 자기 할당 Task: 본인만 접근 가능 (관리자도 제외, 공개 여부와 무관)
  (is_self_task = true AND auth.uid() = assigner_id)
  OR
  -- 일반 비공개 Task: 기존 정책 유지 (관리자 또는 지시자/담당자)
  (is_self_task = false AND is_public = false AND (
    is_admin(auth.uid()) OR 
    auth.uid() = assigner_id OR 
    auth.uid() = assignee_id
  ))
);

COMMENT ON POLICY tasks_select_admin_or_assigned ON public.tasks IS 
'Task 조회 정책: 공개된 Task는 모든 인증된 사용자 접근 가능, 자기 할당 Task는 본인만 접근 가능, 일반 비공개 Task는 관리자 또는 지시자/담당자만 접근 가능';

-- ----------------------------------------------------------------------------
-- 4. UPDATE RLS 정책 수정 - tasks_update_assigner_or_assignee
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS tasks_update_assigner_or_assignee ON public.tasks;

CREATE POLICY tasks_update_assigner_or_assignee ON public.tasks
FOR UPDATE
USING (
  -- 자기 할당 Task: 본인만 수정 가능
  (is_self_task = true AND auth.uid() = assigner_id)
  OR
  -- 일반 Task: 지시자 또는 담당자만 수정 가능
  (is_self_task = false AND (auth.uid() = assigner_id OR auth.uid() = assignee_id))
  OR
  -- 관리자: 모든 Task 수정 가능 (필드별 제어는 애플리케이션 레벨에서 처리)
  is_admin(auth.uid())
)
WITH CHECK (
  -- 동일한 조건 적용
  (is_self_task = true AND auth.uid() = assigner_id)
  OR
  (is_self_task = false AND (auth.uid() = assigner_id OR auth.uid() = assignee_id))
  OR
  is_admin(auth.uid())
);

COMMENT ON POLICY tasks_update_assigner_or_assignee ON public.tasks IS 
'Task 수정 정책: 자기 할당 Task는 본인만 수정 가능, 일반 Task는 지시자/담당자만 수정 가능, 관리자는 모든 Task 수정 가능 (필드별 제어는 API 레벨에서 처리)';

-- ============================================================================
-- Part 2: messages 테이블 RLS 정책 수정
-- ============================================================================
-- 목적: messages 테이블의 RLS 정책을 tasks 테이블과 일치시켜 공개 Task의 메시지도 조회 가능하도록 수정

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

-- ============================================================================
-- Part 3: task_list_items RLS 정책 수정 및 자동 제거 로직
-- ============================================================================
-- 목적: 
-- 1. 공개된 Task를 목록에 추가할 수 있도록 RLS 정책 수정
-- 2. Task가 비공개로 변경되면 목록에서 자동으로 제거하는 트리거 추가

-- ----------------------------------------------------------------------------
-- 1. task_list_items INSERT 정책 수정 (공개 Task 추가 가능하도록)
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "task_list_items_insert_own_list_with_permission" ON public.task_list_items;

CREATE POLICY "task_list_items_insert_own_list_with_permission" ON public.task_list_items
FOR INSERT
WITH CHECK (
  -- 자신이 만든 목록인지 확인
  EXISTS (
    SELECT 1 FROM public.task_lists
    WHERE task_lists.id = task_list_items.task_list_id
    AND task_lists.user_id = auth.uid()
  )
  AND (
    -- 관리자는 모든 Task 추가 가능
    is_admin(auth.uid())
    OR
    -- 멤버는 자신이 assigner 또는 assignee인 Task만 추가 가능
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_list_items.task_id
      AND (tasks.assigner_id = auth.uid() OR tasks.assignee_id = auth.uid())
    )
    OR
    -- 공개된 Task는 모든 인증된 사용자가 추가 가능 (자기 할당 Task 제외)
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_list_items.task_id
      AND tasks.is_public = true
      AND tasks.is_self_task = false
    )
  )
);

COMMENT ON POLICY "task_list_items_insert_own_list_with_permission" ON public.task_list_items IS 
'Task 목록 항목 INSERT 정책: 자신이 만든 목록에만 추가 가능. 관리자는 모든 Task 추가 가능, 멤버는 자신이 assigner/assignee인 Task 또는 공개된 Task 추가 가능';

-- ----------------------------------------------------------------------------
-- 2. Task가 비공개로 변경되면 목록에서 자동 제거하는 함수 생성
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.remove_task_from_lists_on_unpublish()
RETURNS TRIGGER AS $$
BEGIN
  -- 공개 Task가 비공개로 변경되거나, 자기 할당 Task가 된 경우
  -- 일반 사용자가 추가한 항목만 제거 (관리자/assigner/assignee가 만든 목록은 유지)
  IF (
    -- 공개에서 비공개로 변경된 경우
    (OLD.is_public = true AND NEW.is_public = false)
    OR
    -- 자기 할당 Task가 된 경우
    (OLD.is_self_task = false AND NEW.is_self_task = true)
  ) THEN
    -- 일반 사용자가 추가한 항목만 제거
    -- (관리자나 Task의 assigner/assignee가 만든 목록은 유지)
    DELETE FROM public.task_list_items
    WHERE task_id = NEW.id
    AND NOT EXISTS (
      -- 관리자가 만든 목록은 유지
      SELECT 1 FROM public.task_lists
      WHERE task_lists.id = task_list_items.task_list_id
      AND is_admin(task_lists.user_id)
    )
    AND NOT EXISTS (
      -- Task의 assigner 또는 assignee가 만든 목록은 유지
      SELECT 1 FROM public.task_lists
      WHERE task_lists.id = task_list_items.task_list_id
      AND (
        task_lists.user_id = NEW.assigner_id
        OR task_lists.user_id = NEW.assignee_id
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.remove_task_from_lists_on_unpublish() IS 
'Task가 비공개로 변경되거나 자기 할당 Task가 되면, 해당 Task를 목록에서 자동으로 제거하는 함수. 관리자나 Task의 assigner/assignee가 만든 목록은 제외';

-- ----------------------------------------------------------------------------
-- 3. 트리거 생성
-- ----------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trigger_remove_task_from_lists_on_unpublish ON public.tasks;

CREATE TRIGGER trigger_remove_task_from_lists_on_unpublish
AFTER UPDATE OF is_public, is_self_task ON public.tasks
FOR EACH ROW
WHEN (
  -- is_public 또는 is_self_task가 변경된 경우에만 실행
  (OLD.is_public IS DISTINCT FROM NEW.is_public)
  OR
  (OLD.is_self_task IS DISTINCT FROM NEW.is_self_task)
)
EXECUTE FUNCTION public.remove_task_from_lists_on_unpublish();

COMMENT ON TRIGGER trigger_remove_task_from_lists_on_unpublish ON public.tasks IS 
'Task의 공개 상태가 변경되면 목록에서 자동으로 제거하는 트리거';

COMMIT;
