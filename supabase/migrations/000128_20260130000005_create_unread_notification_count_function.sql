-- ============================================================================
-- 읽지 않은 알림 수 조회 함수 생성
-- ============================================================================
-- 목적: 사용자의 읽지 않은 알림 수를 조회하는 함수 생성
-- 
-- 작업 내용:
-- 1. get_unread_notification_count() 함수 생성
-- 2. 사이드바 배지 표시용
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. 읽지 않은 알림 수 조회 함수 생성
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_unread_notification_count(
  p_user_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- 읽지 않은 알림 수 계산
  SELECT COUNT(*) INTO v_count
  FROM public.notifications
  WHERE user_id = p_user_id
    AND is_read = false;

  RETURN COALESCE(v_count, 0);
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. 함수 주석 추가
-- ----------------------------------------------------------------------------

COMMENT ON FUNCTION public.get_unread_notification_count(UUID) IS 
'사용자의 읽지 않은 알림 수를 반환합니다. 사이드바 배지 표시용으로 사용됩니다.';

COMMIT;
