-- ============================================================================
-- Phase 1-3: can_access_profile 함수 수정 - 참조자 조건 추가
-- ============================================================================
-- 목적: 참조자도 Task 관련 사용자의 프로필을 조회할 수 있도록 함수 수정
-- 
-- 변경 사항:
-- - 기존: assigner/assignee만 상대방 프로필 조회 가능
-- - 추가: 참조자도 해당 Task의 assigner/assignee/다른 참조자 프로필 조회 가능
-- 
-- 예시:
-- - Task T1의 지시자 A, 담당자 B, 참조자 C, D가 있는 경우
--   A는 B, C, D 프로필 조회 가능
--   B는 A, C, D 프로필 조회 가능
--   C는 A, B, D 프로필 조회 가능
--   D는 A, B, C 프로필 조회 가능
-- ============================================================================

-- ----------------------------------------------------------------------------
-- can_access_profile 함수 수정
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_access_profile(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Task 기반 프로필 접근 가능 여부 확인 (assigner, assignee, 참조자)
  -- 현재 사용자가 접근할 수 있는 Task에서 target_user_id가 assigner, assignee 또는 참조자로 참여한 경우
  RETURN EXISTS (
    SELECT 1 FROM public.tasks
    WHERE (
      -- target_user_id가 assigner 또는 assignee인 경우
      tasks.assigner_id = target_user_id 
      OR tasks.assignee_id = target_user_id
      -- target_user_id가 참조자인 경우
      OR EXISTS (
        SELECT 1 FROM public.task_references
        WHERE task_references.task_id = tasks.id
        AND task_references.user_id = target_user_id
      )
    )
    AND (
      -- 현재 사용자가 관리자이거나
      is_admin(auth.uid())
      -- 현재 사용자가 해당 Task의 지시자 또는 담당자인 경우
      OR auth.uid() = tasks.assigner_id
      OR auth.uid() = tasks.assignee_id
      -- 현재 사용자가 해당 Task의 참조자인 경우
      OR EXISTS (
        SELECT 1 FROM public.task_references
        WHERE task_references.task_id = tasks.id
        AND task_references.user_id = auth.uid()
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.can_access_profile(UUID) IS 
'프로필 접근 권한 확인 함수: Task를 통해 연결된 경우 프로필 조회 가능. 참조자 기능 추가로 인해 assigner/assignee 외에 참조자도 해당 Task 관련 사용자의 프로필 조회 가능. 현재 사용자가 접근할 수 있는 Task에서 target_user_id가 assigner, assignee 또는 참조자로 참여한 경우 true 반환.';
