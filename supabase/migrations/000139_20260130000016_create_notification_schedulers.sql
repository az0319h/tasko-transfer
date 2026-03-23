-- ============================================================================
-- 알림 시스템 종합 마이그레이션 (최종)
-- ============================================================================
-- 목적: 알림 시스템 전체를 한 번에 설정하는 종합 마이그레이션
-- 
-- 포함 내용:
-- 1. notification_type enum 생성
-- 2. notifications 테이블 생성
-- 3. 인덱스 생성
-- 4. 알림 생성 함수 (create_notification)
-- 5. 읽지 않은 알림 수 조회 함수 (get_unread_notification_count)
-- 6. RLS 정책 설정
-- 7. Realtime 활성화
-- 8. 마감일 임박 알림 스케줄러 설정 (UTC 01:00 = KST 10:00)
-- 9. 마감일 초과 알림 스케줄러 설정 (UTC 01:00 = KST 10:00)
-- 
-- 주의사항:
-- - 프로젝트 URL은 실제 프로젝트 URL로 변경 필요
-- - Service Role Key는 DB 설정 또는 환경 변수로 설정 필요
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. notification_type enum 생성
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type 
    WHERE typname = 'notification_type'
  ) THEN
    CREATE TYPE notification_type AS ENUM (
      'TASK_CREATED',
      'TASK_STATUS_CHANGED',
      'TASK_DELETED',
      'TASK_DUE_DATE_EXCEEDED',
      'TASK_DUE_DATE_APPROACHING'
    );
    
    COMMENT ON TYPE notification_type IS '알림 타입: TASK_CREATED(작업 생성), TASK_STATUS_CHANGED(상태 변경), TASK_DELETED(작업 삭제), TASK_DUE_DATE_EXCEEDED(마감일 초과), TASK_DUE_DATE_APPROACHING(마감일 임박)';
    
    RAISE NOTICE 'notification_type ENUM 타입을 생성했습니다.';
  ELSE
    RAISE NOTICE 'notification_type ENUM 타입이 이미 존재합니다.';
  END IF;
END $$;

-- ============================================================================
-- 2. notifications 테이블 생성
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  notification_type notification_type NOT NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. 인덱스 생성 (성능 최적화)
-- ============================================================================

-- 사용자별 조회 최적화
CREATE INDEX IF NOT EXISTS idx_notifications_user_id 
  ON public.notifications(user_id);

-- 읽지 않은 알림 조회 최적화 (복합 인덱스)
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_is_read 
  ON public.notifications(user_id, is_read) 
  WHERE is_read = false;

-- 시간순 정렬 최적화
CREATE INDEX IF NOT EXISTS idx_notifications_created_at 
  ON public.notifications(created_at DESC);

-- Task별 알림 조회 최적화
CREATE INDEX IF NOT EXISTS idx_notifications_task_id 
  ON public.notifications(task_id) 
  WHERE task_id IS NOT NULL;

-- notification_type별 조회 최적화
CREATE INDEX IF NOT EXISTS idx_notifications_notification_type 
  ON public.notifications(notification_type);

-- metadata JSONB 필드 조회 최적화 (GIN 인덱스)
CREATE INDEX IF NOT EXISTS idx_notifications_metadata 
  ON public.notifications USING GIN (metadata);

-- ============================================================================
-- 4. 알림 생성 함수 생성
-- ============================================================================

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

COMMENT ON FUNCTION public.create_notification(UUID, notification_type, TEXT, TEXT, UUID, JSONB) IS 
'SECURITY DEFINER 함수: 알림을 생성합니다. RLS를 우회하여 시스템에서 호출 가능합니다.';

-- ============================================================================
-- 5. 읽지 않은 알림 수 조회 함수 생성
-- ============================================================================

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

COMMENT ON FUNCTION public.get_unread_notification_count(UUID) IS 
'사용자의 읽지 않은 알림 수를 반환합니다. 사이드바 배지 표시용으로 사용됩니다.';

-- ============================================================================
-- 6. RLS 정책 설정
-- ============================================================================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- SELECT 정책: 사용자는 자신의 알림만 조회 가능
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own"
ON public.notifications
FOR SELECT
USING ((SELECT auth.uid()) = user_id);

-- INSERT 정책: 시스템만 알림 생성 가능
DROP POLICY IF EXISTS "notifications_insert_system_only" ON public.notifications;
CREATE POLICY "notifications_insert_system_only"
ON public.notifications
FOR INSERT
WITH CHECK (false);  -- 일반 사용자는 직접 INSERT 불가 (SECURITY DEFINER 함수만 가능)

-- UPDATE 정책: 사용자는 자신의 알림만 읽음 처리 가능
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own"
ON public.notifications
FOR UPDATE
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

-- DELETE 정책: 사용자는 자신의 알림만 삭제 가능
DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
CREATE POLICY "notifications_delete_own"
ON public.notifications
FOR DELETE
USING ((SELECT auth.uid()) = user_id);

-- ============================================================================
-- 7. Realtime 활성화
-- ============================================================================

-- notifications 테이블에 Realtime 활성화
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- ============================================================================
-- 8. pg_cron 및 pg_net 확장 활성화
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================================
-- 9. 마감일 임박 알림 스케줄러 설정
-- ============================================================================
-- 매일 UTC 01:00 (KST 10:00)에 Edge Function 호출

DO $$
BEGIN
  -- 기존 스케줄 제거 (있는 경우)
  PERFORM cron.unschedule('check_due_date_approaching_daily');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

DO $$
DECLARE
  v_project_url TEXT;
  v_service_role_key TEXT;
  v_function_url TEXT;
BEGIN
  -- 프로젝트 URL 설정
  -- ⚠️ 배포 전 필수: 실제 프로젝트 URL로 변경 필요
  -- Supabase Dashboard > Settings > API > Project URL에서 확인 가능
  v_project_url := 'YOUR_SUPABASE_PROJECT_URL_HERE';  -- 예: 'https://xxxxxxxxxxxxx.supabase.co'
  v_function_url := v_project_url || '/functions/v1/check-due-date-approaching';
  
  -- Service Role Key 설정
  -- ⚠️ 배포 전 필수: Supabase Dashboard > Settings > API > service_role key를 복사하여 아래에 붙여넣기
  -- ⚠️ 보안 주의: 이 파일을 Git에 커밋하기 전에 Service Role Key를 제거하세요
  v_service_role_key := 'YOUR_SERVICE_ROLE_KEY_HERE';
  
  -- Service Role Key가 설정되지 않았으면 경고
  IF v_service_role_key = 'YOUR_SERVICE_ROLE_KEY_HERE' OR v_service_role_key = '' THEN
    RAISE WARNING 'Service Role Key가 설정되지 않았습니다. v_service_role_key 변수에 실제 Service Role Key를 입력해주세요.';
    RAISE WARNING 'Supabase Dashboard > Settings > API > service_role key에서 확인 가능합니다.';
    RETURN;
  END IF;
  
  -- pg_cron 스케줄 생성
  PERFORM cron.schedule(
    'check_due_date_approaching_daily',
    '0 1 * * *',  -- 매일 UTC 01:00 (KST 10:00)
    format('SELECT net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', ''Bearer %s''), body := ''{}''::jsonb);', v_function_url, v_service_role_key)
  );
  
  RAISE NOTICE '마감일 임박 알림 스케줄이 생성되었습니다: 매일 UTC 01:00 (KST 10:00)';
END $$;

-- ============================================================================
-- 10. 마감일 초과 알림 스케줄러 설정
-- ============================================================================
-- 매일 UTC 01:00 (KST 10:00)에 Edge Function 호출

DO $$
BEGIN
  -- 기존 스케줄 제거 (있는 경우)
  PERFORM cron.unschedule('check_due_date_exceeded_daily');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

DO $$
DECLARE
  v_project_url TEXT;
  v_service_role_key TEXT;
  v_function_url TEXT;
BEGIN
  -- 프로젝트 URL 설정
  -- ⚠️ 배포 전 필수: 실제 프로젝트 URL로 변경 필요
  -- Supabase Dashboard > Settings > API > Project URL에서 확인 가능
  v_project_url := 'YOUR_SUPABASE_PROJECT_URL_HERE';  -- 예: 'https://xxxxxxxxxxxxx.supabase.co'
  v_function_url := v_project_url || '/functions/v1/check-due-date-exceeded-notification';
  
  -- Service Role Key 설정
  -- ⚠️ 배포 전 필수: Supabase Dashboard > Settings > API > service_role key를 복사하여 아래에 붙여넣기
  -- ⚠️ 보안 주의: 이 파일을 Git에 커밋하기 전에 Service Role Key를 제거하세요
  v_service_role_key := 'YOUR_SERVICE_ROLE_KEY_HERE';
  
  -- Service Role Key가 설정되지 않았으면 경고
  IF v_service_role_key = 'YOUR_SERVICE_ROLE_KEY_HERE' OR v_service_role_key = '' THEN
    RAISE WARNING 'Service Role Key가 설정되지 않았습니다. v_service_role_key 변수에 실제 Service Role Key를 입력해주세요.';
    RAISE WARNING 'Supabase Dashboard > Settings > API > service_role key에서 확인 가능합니다.';
    RETURN;
  END IF;
  
  -- pg_cron 스케줄 생성
  PERFORM cron.schedule(
    'check_due_date_exceeded_daily',
    '0 1 * * *',  -- 매일 UTC 01:00 (KST 10:00)
    format('SELECT net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', ''Bearer %s''), body := ''{}''::jsonb);', v_function_url, v_service_role_key)
  );
  
  RAISE NOTICE '마감일 초과 알림 스케줄이 생성되었습니다: 매일 UTC 01:00 (KST 10:00)';
END $$;

-- ============================================================================
-- 11. 주석 추가
-- ============================================================================

COMMENT ON TABLE public.notifications IS '알림 테이블: 사용자에게 전송되는 모든 알림을 저장. Realtime 활성화됨.';
COMMENT ON COLUMN public.notifications.user_id IS '알림 수신자 (profiles.id 참조)';
COMMENT ON COLUMN public.notifications.notification_type IS '알림 타입 (notification_type enum)';
COMMENT ON COLUMN public.notifications.task_id IS '관련 Task ID (nullable, Task와 관련 없는 알림의 경우 NULL)';
COMMENT ON COLUMN public.notifications.title IS '알림 제목';
COMMENT ON COLUMN public.notifications.message IS '알림 메시지';
COMMENT ON COLUMN public.notifications.is_read IS '읽음 여부 (기본값: false)';
COMMENT ON COLUMN public.notifications.read_at IS '읽은 시간 (nullable)';
COMMENT ON COLUMN public.notifications.metadata IS '추가 메타데이터 (JSONB, 예: 상태 변경 전/후, days_remaining 등)';
COMMENT ON COLUMN public.notifications.created_at IS '알림 생성 시간';

COMMENT ON EXTENSION pg_cron IS 'pg_cron 확장: 스케줄된 작업 실행';
COMMENT ON EXTENSION pg_net IS 'pg_net 확장: HTTP 요청 실행';

COMMIT;

-- ============================================================================
-- 배포 전 확인 사항
-- ============================================================================
-- 
-- 1. 프로젝트 URL 변경 (⚠️ 배포 전 필수)
--    - 파일 내 v_project_url 변수의 'YOUR_SUPABASE_PROJECT_URL_HERE'를 실제 프로젝트 URL로 변경
--    - Supabase Dashboard > Settings > API > Project URL에서 확인 가능
--    - 예: 'https://xxxxxxxxxxxxx.supabase.co'
-- 
-- 2. Service Role Key 설정 (⚠️ 배포 전 필수)
--    - Supabase Dashboard > Settings > API > service_role key 복사
--    - 파일 내 v_service_role_key 변수의 'YOUR_SERVICE_ROLE_KEY_HERE'를 실제 키로 변경
--    - ⚠️ 보안 주의: Git 커밋 전에 Service Role Key를 제거하거나 .gitignore에 추가
--    - ⚠️ 이 파일은 GitHub에 업로드되므로 실제 키는 포함하지 마세요
-- 
-- 3. Edge Function 배포 확인
--    - check-due-date-approaching (수정된 버전)
--    - check-due-date-exceeded-notification (신규 생성)
-- 
-- 4. 마이그레이션 실행 후 확인
--    - 스케줄러 생성 확인:
--      SELECT * FROM cron.job WHERE jobname IN ('check_due_date_approaching_daily', 'check_due_date_exceeded_daily');
-- 
-- ============================================================================
