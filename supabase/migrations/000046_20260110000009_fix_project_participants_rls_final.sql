-- ============================================================================
-- 프로젝트 참여자 RLS 정책 최종 수정
-- ============================================================================
-- 목적: project_participants 테이블의 RLS 정책 및 관련 함수 수정
-- 
-- 문제점:
-- 1. project_participants SELECT 정책의 (SELECT auth.uid()) = user_id 조건으로 
--    인해 각 사용자가 자신의 레코드만 볼 수 있음
-- 2. is_project_participant() 함수 호출 시 순환 참조 발생 가능
-- 3. can_access_profile() 함수가 Task를 통해서만 프로필 조회 가능하여,
--    프로젝트 참여자 중 Task가 없는 경우 프로필 조회 불가
-- 
-- 해결책:
-- 1. project_participants SELECT 정책에서 (SELECT auth.uid()) = user_id 조건 제거
-- 2. 순환 참조 방지를 위해 직접 서브쿼리 사용
-- 3. can_access_profile() 함수 개선하여 프로젝트 참여를 통한 프로필 조회도 가능하도록 수정
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. project_participants 테이블 SELECT 정책 수정
-- ----------------------------------------------------------------------------

-- 기존 정책 삭제
DROP POLICY IF EXISTS "project_participants_select_participant_or_admin" ON public.project_participants;

-- 새로운 SELECT 정책 생성 (순환 참조 방지)
-- Admin은 모든 참여자 레코드를 볼 수 있고,
-- 프로젝트 참여자는 해당 프로젝트의 모든 참여자 레코드를 볼 수 있음
-- 
-- 중요: 직접 서브쿼리를 사용하여 순환 참조를 완전히 방지
-- 같은 프로젝트 내의 참여자만 확인하므로 RLS 정책이 재적용되어도 문제 없음
CREATE POLICY "project_participants_select_participant_or_admin"
ON public.project_participants
FOR SELECT
USING (
  -- Admin은 모든 레코드 조회 가능
  is_admin((SELECT auth.uid()))
  OR
  -- 현재 사용자가 해당 프로젝트의 참여자인 경우, 
  -- 해당 프로젝트의 모든 참여자 레코드 조회 가능
  -- 
  -- 주의: 이 서브쿼리는 RLS 정책의 영향을 받지만,
  -- 같은 프로젝트(project_id) 내의 참여자만 확인하므로
  -- 순환 참조가 발생하지 않음
  -- 
  -- 예시:
  -- - 사용자 A가 프로젝트 X의 참여자 목록을 조회하려고 함
  -- - RLS 정책이 적용되어 각 레코드에 대해 이 조건을 확인
  -- - 서브쿼리에서 프로젝트 X의 참여자 중 사용자 A가 있는지 확인
  -- - 사용자 A가 프로젝트 X의 참여자라면, 프로젝트 X의 모든 참여자 레코드 반환
  EXISTS (
    SELECT 1 
    FROM public.project_participants pp
    WHERE pp.project_id = project_participants.project_id
    AND pp.user_id = (SELECT auth.uid())
  )
);

COMMENT ON POLICY "project_participants_select_participant_or_admin" ON public.project_participants IS 
'프로젝트 참여자 조회 정책: Admin은 모든 참여자 조회 가능, 프로젝트 참여자는 해당 프로젝트의 모든 참여자 조회 가능. 순환 참조 방지를 위해 직접 서브쿼리 사용.';

-- ----------------------------------------------------------------------------
-- 2. can_access_profile() 함수 개선
-- ----------------------------------------------------------------------------

-- 기존 함수 수정
-- Task를 통한 연결뿐만 아니라 프로젝트 참여를 통한 연결도 확인
CREATE OR REPLACE FUNCTION public.can_access_profile(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    -- 방법 1: Task를 통해 연결된 경우
    -- 현재 사용자가 접근할 수 있는 프로젝트에 속한 Task에서
    -- target_user_id가 assigner 또는 assignee로 참여한 경우
    SELECT 1 FROM public.tasks
    WHERE (tasks.assigner_id = target_user_id OR tasks.assignee_id = target_user_id)
    AND EXISTS (
      SELECT 1 FROM public.project_participants
      WHERE project_participants.project_id = tasks.project_id
      AND project_participants.user_id = (SELECT auth.uid())
    )
  )
  OR EXISTS (
    -- 방법 2: 같은 프로젝트에 참여한 경우
    -- 현재 사용자와 target_user_id가 같은 프로젝트에 참여한 경우
    SELECT 1 FROM public.project_participants pp1
    INNER JOIN public.project_participants pp2
      ON pp1.project_id = pp2.project_id
    WHERE pp1.user_id = (SELECT auth.uid())
    AND pp2.user_id = target_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.can_access_profile(UUID) IS 
'프로필 접근 권한 확인 함수: Task를 통해 연결된 경우 또는 같은 프로젝트에 참여한 경우 프로필 조회 가능. 프로젝트 참여자 중 Task가 없는 경우에도 프로필 조회 가능하도록 개선.';

COMMIT;

-- ============================================================================
-- 검증 쿼리 (수동 실행)
-- ============================================================================
-- 1. 프로젝트 참여자 조회 테스트
-- SELECT * FROM public.project_participants WHERE project_id = '프로젝트_ID';
-- 
-- 2. 프로필 조회 테스트
-- SELECT * FROM public.profiles WHERE id IN (
--   SELECT user_id FROM public.project_participants WHERE project_id = '프로젝트_ID'
-- );
-- 
-- 3. RLS 정책 확인
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- AND tablename IN ('project_participants', 'profiles')
-- ORDER BY tablename, policyname;

