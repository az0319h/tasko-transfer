-- Add REJECTED → IN_PROGRESS email notification to task status change trigger
-- This migration adds support for sending email when a rejected task is restarted
-- Recipient: assigner (지시자) - to notify that the assignee has restarted the work

-- Update the trigger function to include REJECTED → IN_PROGRESS transition
CREATE OR REPLACE FUNCTION public.send_task_status_change_email()
RETURNS TRIGGER AS $$
DECLARE
  assigner_email TEXT;
  assignee_email TEXT;
  assigner_name TEXT;
  assignee_name TEXT;
  changer_name TEXT;
  project_title TEXT;
  recipients_array TEXT[];
  request_body JSONB;
  function_url TEXT;
BEGIN
  -- Only trigger for specific status transitions
  IF OLD.task_status = NEW.task_status THEN
    RETURN NEW;
  END IF;

  -- Check if this is a valid status transition that requires email
  -- Added: REJECTED → IN_PROGRESS (업무 재진행 시작)
  IF NOT (
    (OLD.task_status = 'ASSIGNED' AND NEW.task_status = 'IN_PROGRESS') OR
    (OLD.task_status = 'IN_PROGRESS' AND NEW.task_status = 'WAITING_CONFIRM') OR
    (NEW.task_status IN ('APPROVED', 'REJECTED') AND OLD.task_status = 'WAITING_CONFIRM') OR
    (OLD.task_status = 'REJECTED' AND NEW.task_status = 'IN_PROGRESS')  -- 신규 추가
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
  SELECT COALESCE(full_name, email) INTO changer_name
  FROM public.profiles
  WHERE id = auth.uid();

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
    'changerId', auth.uid()::TEXT,
    'changerName', changer_name,
    'taskTitle', NEW.title,
    'taskDescription', NEW.description,
    'projectTitle', project_title,
    'projectId', NEW.project_id::TEXT,
    'dueDate', NEW.due_date::TEXT,
    'recipients', recipients_array
  );

  -- Get Edge Function URL from environment (set via Supabase config)
  -- In production, this should be: https://[project-ref].supabase.co/functions/v1/send-task-email
  function_url := current_setting('app.edge_function_url', true);
  
  -- Fallback to default pattern if not set
  IF function_url IS NULL OR function_url = '' THEN
    function_url := 'https://' || current_setting('app.supabase_project_ref', true) || '.supabase.co/functions/v1/send-task-email';
  END IF;

  -- Call Edge Function via HTTP (non-blocking)
  -- Use pg_net to make async HTTP request
  PERFORM net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
    ),
    body := request_body::text
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Failed to send email notification: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update comment
COMMENT ON FUNCTION public.send_task_status_change_email() IS 'Trigger function that sends email notifications when task status changes via Edge Function. Now includes REJECTED → IN_PROGRESS transition (업무 재진행 시작 알림).';


