-- ============================================================================
-- Phase 1: Task 4-1 - 데이터베이스 함수 및 트리거 수정
-- ============================================================================
-- 목적: 프로젝트 관련 함수 제거 및 이메일 트리거 수정
-- 
-- 작업 내용:
-- 1. 프로젝트 관련 함수 제거
-- 2. send_task_status_change_email 함수 수정 (project_id, project_title 제거, client_name 추가)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. 프로젝트 관련 함수 제거
-- ----------------------------------------------------------------------------

-- has_task_in_project 함수 제거 (project_id 의존성)
DROP FUNCTION IF EXISTS public.has_task_in_project(UUID, UUID);

-- 프로젝트 관련 함수들 제거 (존재하는 경우에만)
DROP FUNCTION IF EXISTS public.create_project_with_participants(text, text, timestamp with time zone, uuid[]);
DROP FUNCTION IF EXISTS public.get_project_summaries();
DROP FUNCTION IF EXISTS public.has_project_access(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_project_participant(uuid, uuid);

-- ----------------------------------------------------------------------------
-- 2. send_task_status_change_email 함수 수정
-- ----------------------------------------------------------------------------
-- project_id, project_title 제거하고 client_name 사용

CREATE OR REPLACE FUNCTION public.send_task_status_change_email()
RETURNS TRIGGER AS $$
DECLARE
  assigner_email TEXT;
  assignee_email TEXT;
  assigner_name TEXT;
  assignee_name TEXT;
  changer_name TEXT;
  changer_id UUID;
  client_name TEXT;
  recipients_array TEXT[];
  request_body JSONB;
  function_url TEXT;
  service_role_key TEXT;
  http_response_id BIGINT;
BEGIN
  -- 로깅: 트리거 실행 확인
  RAISE NOTICE '[EMAIL_TRIGGER] Status changed: % -> % (task: %)', 
    OLD.task_status, NEW.task_status, NEW.id;

  -- Only trigger for specific status transitions
  IF OLD.task_status = NEW.task_status THEN
    RAISE NOTICE '[EMAIL_TRIGGER] Status unchanged, skipping';
    RETURN NEW;
  END IF;

  -- Check if this is a valid status transition that requires email
  IF NOT (
    (OLD.task_status = 'ASSIGNED' AND NEW.task_status = 'IN_PROGRESS') OR
    (OLD.task_status = 'IN_PROGRESS' AND NEW.task_status = 'WAITING_CONFIRM') OR
    (NEW.task_status IN ('APPROVED', 'REJECTED') AND OLD.task_status = 'WAITING_CONFIRM') OR
    (OLD.task_status = 'REJECTED' AND NEW.task_status = 'IN_PROGRESS')
  ) THEN
    RAISE NOTICE '[EMAIL_TRIGGER] Status transition not eligible for email: % -> %', 
      OLD.task_status, NEW.task_status;
    RETURN NEW;
  END IF;

  -- Get assigner and assignee emails and names from profiles
  SELECT email, COALESCE(full_name, email) INTO assigner_email, assigner_name
  FROM public.profiles
  WHERE id = NEW.assigner_id;

  SELECT email, COALESCE(full_name, email) INTO assignee_email, assignee_name
  FROM public.profiles
  WHERE id = NEW.assignee_id;

  -- Validate email addresses
  IF assigner_email IS NULL OR assignee_email IS NULL THEN
    RAISE WARNING '[EMAIL_TRIGGER] Missing email addresses: assigner=%, assignee=%', 
      assigner_email, assignee_email;
    RETURN NEW;
  END IF;

  -- Get changer name (user who triggered the status change)
  changer_id := auth.uid();
  IF changer_id IS NULL THEN
    -- 시스템 메시지에서 최근 변경자 조회 시도
    SELECT user_id INTO changer_id
    FROM messages
    WHERE task_id = NEW.id
      AND message_type = 'SYSTEM'
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF changer_id IS NULL THEN
      changer_name := '시스템';
    ELSE
      SELECT COALESCE(full_name, email) INTO changer_name
      FROM public.profiles
      WHERE id = changer_id;
    END IF;
  ELSE
    SELECT COALESCE(full_name, email) INTO changer_name
    FROM public.profiles
    WHERE id = changer_id;
  END IF;

  -- Get client_name from task (project_id 대신 사용)
  client_name := NEW.client_name;

  -- Determine recipients based on status transition
  IF OLD.task_status = 'ASSIGNED' AND NEW.task_status = 'IN_PROGRESS' THEN
    recipients_array := ARRAY['assigner', 'assignee'];
  ELSIF OLD.task_status = 'IN_PROGRESS' AND NEW.task_status = 'WAITING_CONFIRM' THEN
    recipients_array := ARRAY['assigner'];
  ELSIF OLD.task_status = 'WAITING_CONFIRM' AND NEW.task_status IN ('APPROVED', 'REJECTED') THEN
    recipients_array := ARRAY['assignee'];
  ELSIF OLD.task_status = 'REJECTED' AND NEW.task_status = 'IN_PROGRESS' THEN
    recipients_array := ARRAY['assigner'];
  ELSE
    recipients_array := ARRAY['assigner', 'assignee'];
  END IF;

  RAISE NOTICE '[EMAIL_TRIGGER] Recipients: %', recipients_array;

  -- Build request body for Edge Function (project_id, project_title 제거, client_name 추가)
  request_body := jsonb_build_object(
    'eventType', 'STATUS_CHANGED',
    'taskId', NEW.id::TEXT,
    'oldStatus', OLD.task_status,
    'newStatus', NEW.task_status,
    'assignerEmail', assigner_email,
    'assigneeEmail', assignee_email,
    'assignerName', assigner_name,
    'assigneeName', assignee_name,
    'changerId', COALESCE(changer_id::TEXT, ''),
    'changerName', changer_name,
    'taskTitle', NEW.title,
    'taskDescription', NEW.description,
    'clientName', COALESCE(client_name, ''),
    'dueDate', COALESCE(NEW.due_date::TEXT, ''),
    'recipients', recipients_array
  );

  -- Edge Function URL: DB 설정에서 로드 (ALTER DATABASE postgres SET app.supabase_function_base_url = 'https://your-project.supabase.co/functions/v1';)
  function_url := rtrim(NULLIF(TRIM(current_setting('app.supabase_function_base_url', true)), ''), '/') || '/send-task-email';
  IF function_url IS NULL OR function_url = '' OR left(function_url, 4) != 'http' THEN
    RAISE WARNING 'app.supabase_function_base_url가 설정되지 않았습니다. 이메일 발송을 건너뜁니다.';
    RETURN NEW;
  END IF;

  -- Service Role Key: DB 설정에서 로드 (ALTER DATABASE postgres SET app.supabase_service_role_key = 'your-key';)
  service_role_key := NULLIF(TRIM(current_setting('app.supabase_service_role_key', true)), '');
  IF service_role_key IS NULL OR service_role_key = '' THEN
    RAISE WARNING 'app.supabase_service_role_key가 설정되지 않았습니다. 이메일 발송을 건너뜁니다.';
    RETURN NEW;
  END IF;

  RAISE NOTICE '[EMAIL_TRIGGER] Calling Edge Function: %', function_url;
  RAISE NOTICE '[EMAIL_TRIGGER] Request body: %', request_body;

  -- Call Edge Function via HTTP (non-blocking)
  -- 올바른 시그니처: net.http_post(url text, body jsonb, params jsonb, headers jsonb)
  SELECT net.http_post(
    url := function_url,
    body := request_body,
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', format('Bearer %s', service_role_key)
    )
  ) INTO http_response_id;

  RAISE NOTICE '[EMAIL_TRIGGER] HTTP request submitted with ID: %', http_response_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[EMAIL_TRIGGER] Failed to send email notification: %', SQLERRM;
    RAISE WARNING '[EMAIL_TRIGGER] Error details: %', SQLSTATE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update comments
COMMENT ON FUNCTION public.send_task_status_change_email() IS 
'Trigger function that sends email notifications when task status changes via Edge Function. Uses hardcoded URL and Service Role Key. ⚠️ 주의: 다른 데이터베이스 환경에 적용할 때는 함수 내부의 하드코딩된 값을 변경해야 합니다. Includes enhanced logging for debugging. Updated to use client_name instead of project_id/project_title.';

COMMIT;
