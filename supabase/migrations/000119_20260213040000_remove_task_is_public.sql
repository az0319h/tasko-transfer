-- ============================================================================
-- Task 공개 설정(is_public) 기능 제거
-- ============================================================================
-- 목적: 공유 모달의 "공개 설정" 제거. 공유 기능(참조자 추가, 링크 복사 등)은 유지.
-- 
-- 제거 항목:
-- - tasks.is_public 컬럼
-- - is_public 관련 RLS 조건 (모든 Task는 assigner/assignee/참조자/admin만 접근)
-- - remove_task_from_lists_on_unpublish 트리거/함수
-- - task_list_items, task_chat_logs, task_chat_log_items의 is_public 조건
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. is_public 변경 시 목록 제거 트리거 삭제
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trigger_remove_task_from_lists_on_unpublish ON public.tasks;
DROP FUNCTION IF EXISTS public.remove_task_from_lists_on_unpublish();

-- ----------------------------------------------------------------------------
-- 2. tasks SELECT 정책 수정 (is_public 제거)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "tasks_select_assigner_assignee_reference_or_admin" ON public.tasks;

CREATE POLICY "tasks_select_assigner_assignee_reference_or_admin"
ON public.tasks
FOR SELECT
USING (
  (is_self_task = true AND auth.uid() = assigner_id)
  OR
  (is_self_task = false AND (
    is_admin((SELECT auth.uid()))
    OR (SELECT auth.uid()) = assigner_id
    OR (SELECT auth.uid()) = assignee_id
    OR is_task_reference(id, (SELECT auth.uid()))
  ))
);

COMMENT ON POLICY "tasks_select_assigner_assignee_reference_or_admin" ON public.tasks IS
'Task 조회 정책: 자기 할당은 본인만, 일반 Task는 admin/지시자/담당자/참조자만. (is_public 제거됨)';

-- ----------------------------------------------------------------------------
-- 3. task_list_items INSERT 정책 수정 (is_public 제거)
-- ----------------------------------------------------------------------------
-- task_list_items_insert_own_list_with_permission: 공개 Task 조건 제거
DROP POLICY IF EXISTS "task_list_items_insert_own_list_with_permission" ON public.task_list_items;

CREATE POLICY "task_list_items_insert_own_list_with_permission" ON public.task_list_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.task_lists
    WHERE task_lists.id = task_list_items.task_list_id
    AND task_lists.user_id = auth.uid()
  )
  AND (
    is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_list_items.task_id
      AND (tasks.assigner_id = auth.uid() OR tasks.assignee_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.task_references tr ON tr.task_id = t.id
      WHERE t.id = task_list_items.task_id
      AND tr.user_id = auth.uid()
    )
  )
);

COMMENT ON POLICY "task_list_items_insert_own_list_with_permission" ON public.task_list_items IS
'Task 목록 항목 INSERT: 자신이 만든 목록에만 추가. 관리자/지시자/담당자/참조자인 Task만 추가 가능.';

-- task_list_items_insert_task_access_with_references: 공개 Task 조건 제거
DROP POLICY IF EXISTS "task_list_items_insert_task_access_with_references" ON public.task_list_items;

CREATE POLICY "task_list_items_insert_task_access_with_references" ON public.task_list_items
FOR INSERT
WITH CHECK (
  EXISTS (
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
'Task 목록 아이템 추가: 지시자/담당자/참조자인 Task만 목록에 추가 가능.';

-- ----------------------------------------------------------------------------
-- 4. task_chat_logs SELECT 정책 수정 (is_public 제거)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "task_chat_logs_select_task_access_with_references" ON public.task_chat_logs;

CREATE POLICY "task_chat_logs_select_task_access_with_references"
ON public.task_chat_logs
FOR SELECT
USING (
  is_admin((SELECT auth.uid()))
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
'채팅 로그 조회: Admin, 지시자/담당자/참조자만 조회 가능.';

-- ----------------------------------------------------------------------------
-- 5. task_chat_log_items SELECT 정책 수정 (is_public 제거)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "task_chat_log_items_select_task_access_with_references" ON public.task_chat_log_items;

CREATE POLICY "task_chat_log_items_select_task_access_with_references"
ON public.task_chat_log_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.task_chat_logs
    JOIN public.tasks ON tasks.id = task_chat_logs.task_id
    WHERE task_chat_logs.id = task_chat_log_items.log_id
    AND (
      is_admin((SELECT auth.uid()))
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
'채팅 로그 아이템 조회: Admin, 지시자/담당자/참조자만 조회 가능.';

-- ----------------------------------------------------------------------------
-- 6. tasks UPDATE 정책에서 is_public 수정 권한 제거
-- ----------------------------------------------------------------------------
-- 20260212000008_task_update_policy_admin_full_edit에서 관리자가 is_public 수정 가능.
-- DB RLS는 컬럼 단위가 아니라 row 단위이므로, UPDATE 정책 자체를 변경할 필요는 없음.
-- is_public 컬럼 삭제 시 해당 권한은 자동으로 사라짐.
-- (API 레벨에서 is_public 처리 제거는 애플리케이션 코드에서 수행)

-- ----------------------------------------------------------------------------
-- 7. idx_tasks_is_public 인덱스 삭제
-- ----------------------------------------------------------------------------
DROP INDEX IF EXISTS idx_tasks_is_public;

-- ----------------------------------------------------------------------------
-- 8. tasks.is_public 컬럼 삭제
-- ----------------------------------------------------------------------------
ALTER TABLE public.tasks DROP COLUMN IF EXISTS is_public;
