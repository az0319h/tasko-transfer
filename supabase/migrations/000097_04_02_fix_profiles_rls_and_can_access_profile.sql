-- ============================================================================
-- Phase 1: Task 4-2 - profiles RLS 정책 및 can_access_profile 함수 수정
-- ============================================================================
-- 목적: 프로젝트 구조 제거에 맞게 can_access_profile 함수 수정 및 profiles RLS 정책 수정
-- 
-- 문제:
-- - can_access_profile 함수가 project_participants 테이블과 tasks.project_id를 참조
-- - 프로젝트 구조가 제거되었지만 함수가 수정되지 않아 RLS 정책 평가 시 에러 발생
-- - profiles_select_same_project 정책이 can_access_profile 함수를 사용하여 404 오류 발생
-- 
-- 작업 내용:
-- 1. can_access_profile 함수 수정 (프로젝트 기반 로직 제거, Task 기반으로만 접근 가능하도록)
-- 2. profiles RLS 정책 수정 (profiles_select_same_project 정책 제거 또는 수정)
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

-- 기존 정책 확인 및 유지 (이미 존재하는 경우)
-- Users can view own profile: (auth.uid() = id)
-- Admins can view all profiles: is_admin(auth.uid())

-- Task 기반 프로필 접근 정책 추가 (선택사항)
-- can_access_profile 함수를 사용하여 Task를 통해 연결된 사용자의 프로필 조회 가능
-- 하지만 기존 정책만으로도 충분하므로 추가하지 않음
-- 필요시 아래 주석을 해제하여 사용 가능:
-- CREATE POLICY "profiles_select_task_connected"
-- ON public.profiles
-- FOR SELECT
-- USING (can_access_profile(id));

COMMIT;
