-- ============================================================================
-- 즉시 적용 가능한 프로필 RLS 정책 수정 SQL
-- ============================================================================
-- 목적: 현재 발생 중인 profiles 테이블 404 오류 즉시 해결
-- 
-- 문제:
-- - can_access_profile 함수가 project_participants 테이블과 tasks.project_id를 참조
-- - 프로젝트 구조가 제거되었지만 함수가 수정되지 않아 RLS 정책 평가 시 에러 발생
-- - profiles_select_same_project 정책이 can_access_profile 함수를 사용하여 404 오류 발생
-- 
-- 해결:
-- 1. can_access_profile 함수를 프로젝트 구조 제거에 맞게 수정
-- 2. profiles_select_same_project 정책 제거 (프로젝트 기반 접근이 더 이상 필요 없음)
-- 
-- ⚠️ 주의: 이 파일은 complete_refactoring.sql에 포함되어 있습니다.
--          complete_refactoring.sql을 적용하면 이 파일은 필요 없습니다.
--          단, 즉시 문제를 해결해야 하는 경우에만 이 파일을 실행하세요.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. can_access_profile 함수 수정
-- ----------------------------------------------------------------------------
-- 프로젝트 구조 제거에 맞게 수정
-- Task를 통해 연결된 경우만 프로필 조회 가능하도록 변경

CREATE OR REPLACE FUNCTION public.can_access_profile(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- 프로젝트 구조가 제거되었으므로 Task 기반으로만 접근 가능 여부 확인
  -- 현재 사용자가 접근할 수 있는 Task에서 target_user_id가 assigner 또는 assignee로 참여한 경우
  RETURN EXISTS (
    SELECT 1 FROM public.tasks
    WHERE (tasks.assigner_id = target_user_id OR tasks.assignee_id = target_user_id)
    AND (
      -- 현재 사용자가 관리자이거나
      is_admin(auth.uid())
      -- 현재 사용자가 해당 Task의 지시자 또는 담당자인 경우
      OR auth.uid() = tasks.assigner_id
      OR auth.uid() = tasks.assignee_id
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.can_access_profile(UUID) IS 
'프로필 접근 권한 확인 함수: Task를 통해 연결된 경우 프로필 조회 가능. 프로젝트 구조 제거에 맞게 수정됨. 현재 사용자가 접근할 수 있는 Task에서 target_user_id가 assigner 또는 assignee로 참여한 경우 true 반환.';

-- ----------------------------------------------------------------------------
-- 2. profiles RLS 정책 수정
-- ----------------------------------------------------------------------------
-- profiles_select_same_project 정책 제거 (프로젝트 구조 제거로 더 이상 필요 없음)
-- 기존 정책들(Users can view own profile, Admins can view all profiles)은 유지

-- 프로젝트 기반 정책 제거
DROP POLICY IF EXISTS "profiles_select_same_project" ON public.profiles;

COMMIT;

-- ============================================================================
-- 검증 쿼리 (수동 실행)
-- ============================================================================
-- 1. can_access_profile 함수가 정상 작동하는지 확인
-- SELECT can_access_profile('사용자_ID'::uuid);
-- 
-- 2. profiles RLS 정책 확인
-- SELECT schemaname, tablename, policyname, qual 
-- FROM pg_policies 
-- WHERE schemaname = 'public' AND tablename = 'profiles' AND cmd = 'SELECT'
-- ORDER BY policyname;
-- 
-- 3. 프로필 조회 테스트 (인증된 사용자로)
-- SELECT * FROM profiles WHERE id = auth.uid();
