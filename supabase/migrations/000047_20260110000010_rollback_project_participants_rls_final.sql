-- ============================================================================
-- 프로젝트 참여자 RLS 정책 롤백
-- ============================================================================
-- 목적: fix_project_participants_rls_final 마이그레이션 롤백
-- 
-- 롤백 내용:
-- 1. project_participants SELECT 정책을 이전 상태로 복원
-- 2. can_access_profile() 함수를 이전 상태로 복원
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. project_participants 테이블 SELECT 정책 롤백
-- ----------------------------------------------------------------------------

-- 기존 정책 삭제
DROP POLICY IF EXISTS "project_participants_select_participant_or_admin" ON public.project_participants;

-- 이전 정책으로 복원 (20260110000002_phase2_rls_policies_verification.sql 기준)
CREATE POLICY "project_participants_select_participant_or_admin"
ON public.project_participants
FOR SELECT
USING (
  is_admin((SELECT auth.uid()))
  OR (SELECT auth.uid()) = user_id
  OR is_project_participant((SELECT auth.uid()), project_id)
);

COMMENT ON POLICY "project_participants_select_participant_or_admin" ON public.project_participants IS 
'프로젝트 참여자 조회 정책: 참여자 또는 Admin만 조회 가능';

-- ----------------------------------------------------------------------------
-- 2. can_access_profile() 함수 롤백
-- ----------------------------------------------------------------------------

-- 이전 함수로 복원 (원래 함수 - has_project_access 사용)
CREATE OR REPLACE FUNCTION public.can_access_profile(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    -- 현재 사용자가 접근할 수 있는 프로젝트에 속한 Task에서
    -- target_user_id가 assigner 또는 assignee로 참여한 경우
    SELECT 1 FROM public.tasks
    WHERE (tasks.assigner_id = target_user_id OR tasks.assignee_id = target_user_id)
    AND has_project_access(auth.uid(), tasks.project_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.can_access_profile(UUID) IS 
'프로필 접근 권한 확인 함수: 동일 프로젝트에 속한 Task의 assigner 또는 assignee인 경우 프로필 조회 가능';

COMMIT;


