-- Fix Email Triggers with Enhanced Logging and Error Handling
-- This migration adds logging to track trigger execution and fixes net.http_post calls
-- Based on Supabase pg_net documentation, the correct signature is:
-- net.http_post(url text, headers jsonb, body text)

-- ============================================================================
-- 1. Fix send_task_created_email function with logging
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
  http_response_id BIGINT;
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

  -- Log trigger execution
  RAISE NOTICE '[send_task_created_email] Trigger executed for task: %', NEW.id;

  -- Get assigner and assignee emails and names from profiles
  SELECT email, COALESCE(full_name, email) INTO assigner_email, assigner_name
  FROM public.profiles
  WHERE id = NEW.assigner_id;

  SELECT email, COALESCE(full_name, email) INTO assignee_email, assignee_name
  FROM public.profiles
  WHERE id = NEW.assignee_id;

  -- Validate email addresses
  IF assigner_email IS NULL OR assignee_email IS NULL THEN
    RAISE WARNING '[send_task_created_email] Missing email addresses: assigner=%, assignee=%', assigner_email, assignee_email;
    RETURN NEW;
  END IF;

  -- Get project title
  SELECT title INTO project_title
  FROM public.projects
  WHERE id = NEW.project_id;

  IF project_title IS NULL THEN
    RAISE WARNING '[send_task_created_email] Project not found: %', NEW.project_id;
    RETURN NEW;
  END IF;

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
    'dueDate', COALESCE(NEW.due_date::TEXT, ''),
    'recipients', ARRAY['assigner', 'assignee']
  );

  function_url := rtrim(v_base_url, '/') || '/send-task-email';

  RAISE NOTICE '[send_task_created_email] Calling Edge Function: %', function_url;
  RAISE NOTICE '[send_task_created_email] Request body: %', request_body;

  -- Call Edge Function via HTTP (non-blocking)
  -- Correct signature: net.http_post(url text, headers jsonb, body text)
  -- Using named parameters for clarity
  SELECT net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := request_body::text
  ) INTO http_response_id;

  RAISE NOTICE '[send_task_created_email] HTTP request submitted with ID: %', http_response_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[send_task_created_email] Failed to send email notification: %', SQLERRM;
    RAISE WARNING '[send_task_created_email] Error details: %', SQLSTATE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. Fix send_task_status_change_email function with logging
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
  http_response_id BIGINT;
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

  -- Log trigger execution
  RAISE NOTICE '[send_task_status_change_email] Trigger executed: % -> % (task: %)', 
    OLD.task_status, NEW.task_status, NEW.id;

  -- Only trigger for specific status transitions
  IF OLD.task_status = NEW.task_status THEN
    RAISE NOTICE '[send_task_status_change_email] Status unchanged, skipping';
    RETURN NEW;
  END IF;

  -- Check if this is a valid status transition that requires email
  IF NOT (
    (OLD.task_status = 'ASSIGNED' AND NEW.task_status = 'IN_PROGRESS') OR
    (OLD.task_status = 'IN_PROGRESS' AND NEW.task_status = 'WAITING_CONFIRM') OR
    (NEW.task_status IN ('APPROVED', 'REJECTED') AND OLD.task_status = 'WAITING_CONFIRM') OR
    (OLD.task_status = 'REJECTED' AND NEW.task_status = 'IN_PROGRESS')
  ) THEN
    RAISE NOTICE '[send_task_status_change_email] Status transition not eligible for email: % -> %', 
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
    RAISE WARNING '[send_task_status_change_email] Missing email addresses: assigner=%, assignee=%', 
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

  -- Get project title
  SELECT title INTO project_title
  FROM public.projects
  WHERE id = NEW.project_id;

  IF project_title IS NULL THEN
    RAISE WARNING '[send_task_status_change_email] Project not found: %', NEW.project_id;
    RETURN NEW;
  END IF;

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

  RAISE NOTICE '[send_task_status_change_email] Recipients: %', recipients_array;

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
    'dueDate', COALESCE(NEW.due_date::TEXT, ''),
    'recipients', recipients_array
  );

  function_url := rtrim(v_base_url, '/') || '/send-task-email';

  RAISE NOTICE '[send_task_status_change_email] Calling Edge Function: %', function_url;
  RAISE NOTICE '[send_task_status_change_email] Request body: %', request_body;

  -- Call Edge Function via HTTP (non-blocking)
  -- Correct signature: net.http_post(url text, headers jsonb, body text)
  SELECT net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := request_body::text
  ) INTO http_response_id;

  RAISE NOTICE '[send_task_status_change_email] HTTP request submitted with ID: %', http_response_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[send_task_status_change_email] Failed to send email notification: %', SQLERRM;
    RAISE WARNING '[send_task_status_change_email] Error details: %', SQLSTATE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update comments
COMMENT ON FUNCTION public.send_task_created_email() IS 'Trigger function that sends email notifications when task is created via Edge Function. Uses hardcoded URL and Service Role Key. Includes enhanced logging for debugging.';
COMMENT ON FUNCTION public.send_task_status_change_email() IS 'Trigger function that sends email notifications when task status changes via Edge Function. Uses hardcoded URL and Service Role Key. Includes enhanced logging for debugging. Includes REJECTED → IN_PROGRESS transition.';


