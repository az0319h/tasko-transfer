-- ============================================================================
-- 마감일 초과 알림 스케줄러 설정
-- ============================================================================
-- 목적: 매일 UTC 00:00 (KST 09:00)에 마감일 초과 알림 Edge Function 자동 실행
-- 
-- 작업 내용:
-- 1. 기존 스케줄 제거 (있는 경우)
-- 2. pg_cron 스케줄 생성
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. 기존 스케줄 제거 (있는 경우)
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  -- pg_cron 스케줄 제거
  PERFORM cron.unschedule('check_due_date_exceeded_daily');
EXCEPTION
  WHEN OTHERS THEN
    -- 스케줄이 없으면 무시
    NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 2. pg_cron 스케줄 생성
-- ----------------------------------------------------------------------------
-- 매일 UTC 00:00 (KST 09:00)에 Edge Function 호출
-- 
-- 주의: Service Role Key는 실제 값으로 교체해야 합니다.
-- Supabase Dashboard > Settings > API > service_role key에서 확인 가능합니다.

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
  
  -- Service Role Key는 환경 변수에서 가져오거나 하드코딩
  -- 보안상의 이유로 마이그레이션 파일에 직접 포함하지 않는 것을 권장합니다.
  -- 대신 Supabase Dashboard에서 설정하거나, 별도의 설정 테이블을 사용합니다.
  
  -- Service Role Key를 current_setting으로 가져오기 시도
  BEGIN
    v_service_role_key := current_setting('app.supabase_service_role_key', true);
  EXCEPTION
    WHEN OTHERS THEN
      -- 환경 변수가 설정되지 않은 경우, 사용자에게 경고
      RAISE WARNING 'Service Role Key가 설정되지 않았습니다. Supabase Dashboard에서 설정하거나 환경 변수를 설정해주세요.';
      -- 기본값으로 빈 문자열 사용 (실제로는 작동하지 않음)
      v_service_role_key := '';
  END;
  
  -- Service Role Key가 없으면 스케줄 생성하지 않음
  IF v_service_role_key = '' THEN
    RAISE WARNING 'Service Role Key가 설정되지 않아 스케줄을 생성하지 않습니다.';
    RAISE WARNING '수동으로 스케줄을 생성하려면 Supabase Dashboard에서 확인하세요.';
    RETURN;
  END IF;
  
  -- pg_cron 스케줄 생성
  PERFORM cron.schedule(
    'check_due_date_exceeded_daily',
    '0 0 * * *',  -- 매일 UTC 00:00 (KST 09:00)
    format('SELECT net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', ''Bearer '' || current_setting(''app.supabase_service_role_key'', true)), body := ''{}''::jsonb);', v_function_url)
  );
  
  RAISE NOTICE '마감일 초과 알림 스케줄이 생성되었습니다: 매일 UTC 00:00 (KST 09:00)';
END $$;

COMMIT;

-- ============================================================================
-- 참고: Service Role Key 설정 방법
-- ============================================================================
-- 
-- 방법 1: Supabase Dashboard에서 설정
-- 1. Supabase Dashboard > Settings > API
-- 2. service_role key 복사
-- 3. 다음 SQL을 실행하여 설정:
--    ALTER DATABASE postgres SET app.supabase_service_role_key = 'your-service-role-key';
-- 
-- 방법 2: 환경 변수로 설정 (Supabase 프로젝트 설정에서)
-- 
-- 방법 3: 수동으로 스케줄 생성 (Service Role Key 직접 입력)
-- SELECT cron.schedule(
--   'check_due_date_exceeded_daily',
--   '0 0 * * *',
--   $$
--   SELECT net.http_post(
--     url := 'YOUR_SUPABASE_PROJECT_URL_HERE/functions/v1/check-due-date-exceeded-notification',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY_HERE'
--     ),
--     body := '{}'::jsonb
--   );
--   $$);
-- ============================================================================
