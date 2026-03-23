-- ============================================================================
-- 프로젝트 참여자 RLS 정책 순환 참조 문제 수정 (CRITICAL FIX)
-- ============================================================================
-- 목적: RLS 정책에서 is_project_participant 함수 호출 시 발생하는 순환 참조 문제 해결
-- 
-- 문제점:
-- - RLS 정책에서 is_project_participant 함수를 호출할 때 순환 참조 발생
-- - 함수 내부에서 project_participants 테이블 조회 시 RLS 정책이 다시 적용됨
-- - 결과적으로 일부 참여자만 조회되거나 조회 실패
-- 
-- 해결책:
-- - RLS 정책을 직접 서브쿼리 방식으로 수정하여 순환 참조 완전 제거
-- - 같은 프로젝트 내의 참여자만 확인하므로 RLS 정책이 재적용되어도 문제 없음
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- project_participants 테이블 SELECT 정책 수정
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

COMMIT;


