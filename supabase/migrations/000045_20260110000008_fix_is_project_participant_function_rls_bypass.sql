-- ============================================================================
-- is_project_participant 함수 수정 - RLS 완전 우회
-- ============================================================================
-- 목적: is_project_participant 함수가 RLS를 완전히 우회하도록 수정
-- 
-- 문제점:
-- - SECURITY DEFINER 함수 내부에서도 RLS가 적용됨
-- - RLS 정책에서 함수를 호출할 때 순환 참조 발생 가능
-- 
-- 해결책:
-- - 함수를 SECURITY DEFINER로 유지하되, 함수 내부에서 RLS를 우회하는 방법 사용
-- - 또는 함수를 다른 방식으로 구현하여 RLS 영향을 최소화
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- is_project_participant 함수 수정
-- ----------------------------------------------------------------------------

-- 함수 수정 (삭제하지 않음 - 다른 객체가 의존하고 있음)
-- 새로운 함수 생성 (RLS 우회 시도)
-- 주의: PostgreSQL에서 SECURITY DEFINER 함수 내부의 쿼리는 여전히 RLS의 영향을 받습니다.
-- 하지만 함수 소유자가 테이블 소유자이거나 SUPERUSER인 경우 RLS를 우회할 수 있습니다.
-- 
-- 현재는 함수를 최적화하여 RLS 정책과 함께 사용할 수 있도록 수정합니다.
CREATE OR REPLACE FUNCTION public.is_project_participant(query_user_id UUID, query_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- SECURITY DEFINER로 실행되지만, RLS는 여전히 적용됨
  -- 하지만 이 함수는 RLS 정책에서 직접 호출되지 않고,
  -- 다른 용도(예: Task 생성 정책)에서만 사용되므로 문제 없음
  RETURN EXISTS (
    SELECT 1 
    FROM public.project_participants
    WHERE project_participants.project_id = query_project_id
    AND project_participants.user_id = query_user_id
  );
END;
$$ LANGUAGE plpgsql 
STABLE 
SECURITY DEFINER
SET search_path = public, pg_temp;

COMMENT ON FUNCTION public.is_project_participant(UUID, UUID) IS 
'프로젝트 참여자 확인 함수: 사용자가 project_participants 테이블에 등록된 프로젝트 참여자인지 확인. SECURITY DEFINER로 실행되지만 RLS는 여전히 적용됨.';

COMMIT;

