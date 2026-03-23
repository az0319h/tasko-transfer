-- Ensure both email trigger functions use hardcoded values
-- This migration ensures both send_task_created_email and send_task_status_change_email
-- use hardcoded Edge Function URL and Service Role Key for reliability

-- ============================================================================
-- 1. Fix send_task_created_email function (Task 생성 시 이메일 발송)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.send_task_created_email()
RETURNS TRIGGER AS $$
DECLARE
  assigner_email TEXT;
  assignee_email TEXT;
  assigner_name TEXT;
  assignee_name TEXT;
  project_title TEXT;
  request_body JSONB;
  function_url TEXT;
  v_service_role_key TEXT;
  v_base_url TEXT;
BEGIN
  v_base_url := NULLIF(TRIM(current_setting('app.supabase_function_base_url', true)), '');
  IF v_base_url IS NULL OR v_base_url = '' THEN
    RAISE WARNING 'app.supabase_function_base_url가 설정되지 않았습니다. 이메일 발송을 건너뜁니다.';
    RETURN NEW;
  END IF;
  v_service_role_key := NULLIF(TRIM(current_setting('app.supabase_service_role_key', true)), '');
  IF v_service_role_key IS NULL OR v_service_role_key = '' THEN
    RAISE WARNING 'app.supabase_service_role_key가 설정되지 않았습니다. 이메일 발송을 건너뜁니다.';
    RETURN NEW;
  END IF;

  -- Get assigner and assignee emails and names from profiles
  SELECT email, COALESCE(full_name, email) INTO assigner_email, assigner_name
  FROM public.profiles
  WHERE id = NEW.assigner_id;

  SELECT email, COALESCE(full_name, email) INTO assignee_email, assignee_name
  FROM public.profiles
  WHERE id = NEW.assignee_id;

  -- Get project title
  SELECT title INTO project_title
  FROM public.projects
  WHERE id = NEW.project_id;

  -- Build request body for Edge Function
  request_body := jsonb_build_object(
    'eventType', 'TASK_CREATED',
    'taskId', NEW.id::TEXT,
    'assignerEmail', assigner_email,
    'assigneeEmail', assignee_email,
    'assignerName', assigner_name,
    'assigneeName', assignee_name,
    'taskTitle', NEW.title,
    'taskDescription', NEW.description,
    'projectTitle', project_title,
    'projectId', NEW.project_id::TEXT,
    'dueDate', NEW.due_date::TEXT,
    'recipients', ARRAY['assigner', 'assignee']
  );

  function_url := rtrim(v_base_url, '/') || '/send-task-email';

  -- Call Edge Function via HTTP (non-blocking)
  PERFORM net.http_post(
    url := function_url,
    body := request_body,
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to send task creation email notification: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. Fix send_task_status_change_email function (Task 상태 변경 시 이메일 발송)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.send_task_status_change_email()
RETURNS TRIGGER AS $$
DECLARE
  assigner_email TEXT;
  assignee_email TEXT;
  assigner_name TEXT;
  assignee_name TEXT;
  changer_name TEXT;
  changer_id UUID;
  project_title TEXT;
  recipients_array TEXT[];
  request_body JSONB;
  function_url TEXT;
  v_service_role_key TEXT;
  v_base_url TEXT;
BEGIN
  v_base_url := NULLIF(TRIM(current_setting('app.supabase_function_base_url', true)), '');
  IF v_base_url IS NULL OR v_base_url = '' THEN
    RAISE WARNING 'app.supabase_function_base_url가 설정되지 않았습니다. 이메일 발송을 건너뜁니다.';
    RETURN NEW;
  END IF;
  v_service_role_key := NULLIF(TRIM(current_setting('app.supabase_service_role_key', true)), '');
  IF v_service_role_key IS NULL OR v_service_role_key = '' THEN
    RAISE WARNING 'app.supabase_service_role_key가 설정되지 않았습니다. 이메일 발송을 건너뜁니다.';
    RETURN NEW;
  END IF;

  -- Only trigger for specific status transitions
  IF OLD.task_status = NEW.task_status THEN
    RETURN NEW;
  END IF;

  -- Check if this is a valid status transition that requires email
  IF NOT (
    (OLD.task_status = 'ASSIGNED' AND NEW.task_status = 'IN_PROGRESS') OR
    (OLD.task_status = 'IN_PROGRESS' AND NEW.task_status = 'WAITING_CONFIRM') OR
    (NEW.task_status IN ('APPROVED', 'REJECTED') AND OLD.task_status = 'WAITING_CONFIRM') OR
    (OLD.task_status = 'REJECTED' AND NEW.task_status = 'IN_PROGRESS')
  ) THEN
    RETURN NEW;
  END IF;

  -- Get assigner and assignee emails and names from profiles
  SELECT email, COALESCE(full_name, email) INTO assigner_email, assigner_name
  FROM public.profiles
  WHERE id = NEW.assigner_id;

  SELECT email, COALESCE(full_name, email) INTO assignee_email, assignee_name
  FROM public.profiles
  WHERE id = NEW.assignee_id;

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

  -- Get project title
  SELECT title INTO project_title
  FROM public.projects
  WHERE id = NEW.project_id;

  -- Determine recipients based on status transition
  IF OLD.task_status = 'ASSIGNED' AND NEW.task_status = 'IN_PROGRESS' THEN
    -- ASSIGNED → IN_PROGRESS: assigner, assignee 모두에게 발송
    recipients_array := ARRAY['assigner', 'assignee'];
  ELSIF OLD.task_status = 'IN_PROGRESS' AND NEW.task_status = 'WAITING_CONFIRM' THEN
    -- IN_PROGRESS → WAITING_CONFIRM: assigner에게만 발송
    recipients_array := ARRAY['assigner'];
  ELSIF OLD.task_status = 'WAITING_CONFIRM' AND NEW.task_status IN ('APPROVED', 'REJECTED') THEN
    -- WAITING_CONFIRM → APPROVED/REJECTED: assignee에게만 발송
    recipients_array := ARRAY['assignee'];
  ELSIF OLD.task_status = 'REJECTED' AND NEW.task_status = 'IN_PROGRESS' THEN
    -- REJECTED → IN_PROGRESS: assigner에게만 발송 (업무 재진행 시작 알림)
    recipients_array := ARRAY['assigner'];
  ELSE
    -- Should not reach here due to earlier check, but set default
    recipients_array := ARRAY['assigner', 'assignee'];
  END IF;

  -- Build request body for Edge Function
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
    'projectTitle', project_title,
    'projectId', NEW.project_id::TEXT,
    'dueDate', NEW.due_date::TEXT,
    'recipients', recipients_array
  );

  function_url := rtrim(v_base_url, '/') || '/send-task-email';

  -- Call Edge Function via HTTP (non-blocking)
  PERFORM net.http_post(
    url := function_url,
    body := request_body,
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to send email notification: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update comments
COMMENT ON FUNCTION public.send_task_created_email() IS 'Trigger function that sends email notifications when task is created via Edge Function. Uses hardcoded URL and Service Role Key for reliability.';
COMMENT ON FUNCTION public.send_task_status_change_email() IS 'Trigger function that sends email notifications when task status changes via Edge Function. Uses hardcoded URL and Service Role Key for reliability. Includes REJECTED → IN_PROGRESS transition.';


