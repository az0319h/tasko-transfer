-- ============================================================================
-- RLS 무한 재귀 수정: tasks ↔ task_references 순환 참조 제거
-- ============================================================================
-- 원인: tasks 정책이 task_references를 읽고,
--       task_references 정책이 tasks를 읽으며 다시 task_references를 참조 → 무한 재귀
-- 해결: SECURITY DEFINER 함수로 task_references 조회 시 RLS 우회
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. is_task_reference 함수 생성 (SECURITY DEFINER - RLS 우회)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_task_reference(p_task_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.task_references
    WHERE task_id = p_task_id AND user_id = p_user_id
  );
$$;

COMMENT ON FUNCTION public.is_task_reference(UUID, UUID) IS
'참조자 여부 확인. SECURITY DEFINER로 RLS 우회하여 tasks 정책 내 task_references 조회 시 무한 재귀 방지.';

-- ----------------------------------------------------------------------------
-- 2. tasks SELECT 정책: task_references 직접 조회 제거, 함수 사용
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "tasks_select_assigner_assignee_reference_or_admin" ON public.tasks;

CREATE POLICY "tasks_select_assigner_assignee_reference_or_admin"
ON public.tasks
FOR SELECT
USING (
  (is_public = true AND is_self_task = false)
  OR
  (is_self_task = true AND auth.uid() = assigner_id)
  OR
  (is_self_task = false AND is_public = false AND (
    is_admin((SELECT auth.uid()))
    OR (SELECT auth.uid()) = assigner_id
    OR (SELECT auth.uid()) = assignee_id
    OR is_task_reference(id, (SELECT auth.uid()))
  ))
);

COMMENT ON POLICY "tasks_select_assigner_assignee_reference_or_admin" ON public.tasks IS
'Task 조회 정책. is_task_reference() 함수 사용으로 task_references RLS 재귀 방지.';

-- ----------------------------------------------------------------------------
-- 3. task_references SELECT 정책: 자기 참조(재귀) 제거
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "task_references_select_task_participants_or_admin" ON public.task_references;

CREATE POLICY "task_references_select_task_participants_or_admin"
ON public.task_references
FOR SELECT
USING (
  is_admin((SELECT auth.uid()))
  OR user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = task_references.task_id
    AND (tasks.assigner_id = (SELECT auth.uid()) OR tasks.assignee_id = (SELECT auth.uid()))
  )
);

COMMENT ON POLICY "task_references_select_task_participants_or_admin" ON public.task_references IS
'참조자 조회 정책. tasks→task_references 재귀 제거. assigner/assignee는 tasks만 조회, reference는 본인 행(user_id)만 조회.';
