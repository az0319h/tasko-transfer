-- ============================================================================
-- can_access_profile() 함수 수정 - 프로젝트 참여 관계 기반 접근 허용
-- ============================================================================
-- 목적: 프로젝트 참여자 간 프로필 조회 가능하도록 함수 수정
-- 
-- 문제점:
-- - can_access_profile() 함수가 Task를 통해서만 프로필 조회를 허용
-- - 프로젝트 참여자 중 Task가 없는 경우 프로필 조회 불가
-- - 멤버가 프로젝트 참여자 목록을 정확히 확인할 수 없음
-- 
-- 해결책:
-- - Task를 통한 연결 확인 (기존 유지)
-- - 프로젝트 참여를 통한 연결 확인 추가
-- - 같은 프로젝트에 참여한 사용자의 프로필도 조회 가능하도록 수정
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- can_access_profile() 함수 수정
-- ----------------------------------------------------------------------------

-- 기존 함수 수정
-- Task를 통한 연결뿐만 아니라 프로젝트 참여를 통한 연결도 확인
CREATE OR REPLACE FUNCTION public.can_access_profile(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    -- 방법 1: Task를 통해 연결된 경우 (기존 로직 유지)
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
    -- 방법 2: 같은 프로젝트에 참여한 경우 (새로 추가)
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
-- 1. 함수 정의 확인
-- SELECT 
--   p.proname as function_name,
--   pg_get_functiondef(p.oid) as function_definition
-- FROM pg_proc p
-- JOIN pg_namespace n ON p.pronamespace = n.oid
-- WHERE n.nspname = 'public'
-- AND p.proname = 'can_access_profile';
-- 
-- 2. 프로젝트 참여자 프로필 조회 테스트 (멤버 계정으로)
-- SELECT 
--   pp.user_id,
--   pr.email,
--   pr.full_name,
--   can_access_profile(pp.user_id) as can_access
-- FROM public.project_participants pp
-- LEFT JOIN public.profiles pr ON pp.user_id = pr.id
-- WHERE pp.project_id = '프로젝트_ID'
-- ORDER BY pp.created_at DESC;

