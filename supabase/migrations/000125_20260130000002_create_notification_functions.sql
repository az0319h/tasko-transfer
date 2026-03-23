-- ============================================================================
-- 알림 생성 함수 생성
-- ============================================================================
-- 목적: 알림을 생성하는 SECURITY DEFINER 함수 생성
-- 
-- 작업 내용:
-- 1. create_notification() 함수 생성
-- 2. RLS 우회하여 시스템에서 알림 생성 가능하도록 설정
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. create_notification() 함수 생성
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_notification_type notification_type,
  p_title TEXT,
  p_message TEXT,
  p_task_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  -- 알림 생성
  INSERT INTO public.notifications (
    user_id,
    notification_type,
    task_id,
    title,
    message,
    metadata
  ) VALUES (
    p_user_id,
    p_notification_type,
    p_task_id,
    p_title,
    p_message,
    p_metadata
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
EXCEPTION
  WHEN OTHERS THEN
    -- 에러 발생 시 로깅하고 NULL 반환
    RAISE WARNING 'Failed to create notification: %', SQLERRM;
    RETURN NULL;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. 함수 주석 추가
-- ----------------------------------------------------------------------------

COMMENT ON FUNCTION public.create_notification(UUID, notification_type, UUID, TEXT, TEXT, JSONB) IS 
'SECURITY DEFINER 함수: 알림을 생성합니다. RLS를 우회하여 시스템에서 호출 가능합니다.';

COMMIT;
