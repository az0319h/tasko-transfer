-- Database Trigger: Automatically send email when task is created
-- This trigger calls the Edge Function via HTTP when a new task is inserted
-- Sends different emails to assigner and assignee

-- Function to call Edge Function via HTTP when task is created
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
BEGIN
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
  -- Task creation: both assigner and assignee receive emails with different templates
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
    RAISE WARNING 'Failed to send task creation email notification: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on tasks table for INSERT events
CREATE TRIGGER trigger_send_task_created_email
  AFTER INSERT ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.send_task_created_email();

-- Add comments
COMMENT ON FUNCTION public.send_task_created_email() IS 'Trigger function that sends email notifications when task is created via Edge Function. Sends different emails to assigner and assignee.';
COMMENT ON TRIGGER trigger_send_task_created_email ON public.tasks IS 'Automatically sends email when task is created (assigner receives "you assigned task to assignee", assignee receives "assigner assigned task to you")';

