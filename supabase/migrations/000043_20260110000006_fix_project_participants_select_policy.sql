-- ============================================================================
-- 프로젝트 참여자 SELECT RLS 정책 수정
-- ============================================================================
-- 목적: 프로젝트 참여자가 해당 프로젝트의 모든 참여자 레코드를 볼 수 있도록 정책 수정
-- 
-- 문제점:
-- - 기존 정책의 `(SELECT auth.uid()) = user_id` 조건으로 인해 각 사용자가 자신의 레코드만 볼 수 있었음
-- - `is_project_participant` 함수 호출 시 순환 참조 가능성
-- 
-- 해결책:
-- - 프로젝트 참여자는 해당 프로젝트의 모든 참여자 레코드를 볼 수 있도록 정책 수정
-- - EXISTS 서브쿼리를 사용하여 현재 사용자가 해당 프로젝트의 참여자인지 확인
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- project_participants 테이블 SELECT 정책 수정
-- ----------------------------------------------------------------------------

-- 기존 정책 삭제
DROP POLICY IF EXISTS "project_participants_select_participant_or_admin" ON public.project_participants;

-- 새로운 SELECT 정책 생성
-- Admin은 모든 참여자 레코드를 볼 수 있고,
-- 프로젝트 참여자는 해당 프로젝트의 모든 참여자 레코드를 볼 수 있음
-- 
-- 주의: is_project_participant 함수는 SECURITY DEFINER로 설정되어 있어
-- RLS 정책을 우회할 수 있으므로 순환 참조 문제를 방지할 수 있음
CREATE POLICY "project_participants_select_participant_or_admin"
ON public.project_participants
FOR SELECT
USING (
  -- Admin은 모든 레코드 조회 가능
  is_admin((SELECT auth.uid()))
  OR
  -- 현재 사용자가 해당 프로젝트의 참여자인 경우, 해당 프로젝트의 모든 참여자 레코드 조회 가능
  -- is_project_participant 함수는 SECURITY DEFINER로 RLS를 우회하므로 순환 참조 문제 없음
  is_project_participant((SELECT auth.uid()), project_id)
);

COMMENT ON POLICY "project_participants_select_participant_or_admin" ON public.project_participants IS 
'프로젝트 참여자 조회 정책: Admin은 모든 참여자 조회 가능, 프로젝트 참여자는 해당 프로젝트의 모든 참여자 조회 가능';

COMMIT;

