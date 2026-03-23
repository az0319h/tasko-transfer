-- ============================================================================
-- Task 공유 기능 구현 - task_list_items RLS 정책 수정 및 자동 제거 로직
-- ============================================================================
-- 목적: 
-- 1. 공개된 Task를 목록에 추가할 수 있도록 RLS 정책 수정
-- 2. Task가 비공개로 변경되면 목록에서 자동으로 제거하는 트리거 추가
-- ============================================================================

BEGIN;

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
