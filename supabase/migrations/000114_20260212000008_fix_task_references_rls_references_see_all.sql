-- ============================================================================
-- task_references RLS: 참조자가 다른 참조자도 조회할 수 있도록 수정
-- ============================================================================
-- 원인: fix_rls_infinite_recursion에서 참조자는 user_id=auth.uid()인 행만 조회 가능하게 변경됨
--       → 참조자 A가 조회 시 본인 행만 반환, 참조자 B가 누락되어 totalParticipants=3 (실제 4명)
--       → 채팅에서 미읽음 숫자(2, 1) 계산 오류
--
-- 해결: 참조자도 해당 Task의 모든 참조자 행을 볼 수 있도록 정책 수정
--       is_task_reference() 함수 사용 → RLS 우회하여 재귀 없이 참조자 여부 확인
-- ============================================================================

DROP POLICY IF EXISTS "task_references_select_task_participants_or_admin" ON public.task_references;

CREATE POLICY "task_references_select_task_participants_or_admin"
ON public.task_references
FOR SELECT
USING (
  is_admin((SELECT auth.uid()))
  -- 본인 행 (reference인 경우)
  OR user_id = (SELECT auth.uid())
  -- assigner/assignee는 해당 Task의 모든 참조자 조회 가능
  OR EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = task_references.task_id
    AND (tasks.assigner_id = (SELECT auth.uid()) OR tasks.assignee_id = (SELECT auth.uid()))
  )
  -- 참조자도 해당 Task의 모든 참조자 조회 가능 (is_task_reference로 재귀 방지)
  OR is_task_reference(task_references.task_id, (SELECT auth.uid()))
);

COMMENT ON POLICY "task_references_select_task_participants_or_admin" ON public.task_references IS
'참조자 조회 정책. Admin/assigner/assignee: 전체 조회. 참조자: 해당 Task의 모든 참조자(본인 포함) 조회 가능. is_task_reference()로 재귀 방지.';
