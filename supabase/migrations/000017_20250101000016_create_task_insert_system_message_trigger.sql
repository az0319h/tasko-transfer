-- Database Trigger: Automatically create SYSTEM message when task is created
-- This trigger creates a SYSTEM type message in the messages table when a new task is inserted

CREATE OR REPLACE FUNCTION public.create_task_created_system_message()
RETURNS TRIGGER AS $$
DECLARE
  assigner_name TEXT;
  assignee_name TEXT;
  message_content TEXT;
BEGIN
  -- Get assigner and assignee names from profiles
  SELECT COALESCE(full_name, email) INTO assigner_name
  FROM public.profiles
  WHERE id = NEW.assigner_id;

  SELECT COALESCE(full_name, email) INTO assignee_name
  FROM public.profiles
  WHERE id = NEW.assignee_id;

  -- Create system message content
  message_content := format(
    '업무가 할당되었습니다. (지시자: %s, 담당자: %s)',
    assigner_name,
    assignee_name
  );

  -- Insert SYSTEM message
  INSERT INTO public.messages (
    task_id,
    user_id,
    content,
    message_type
  ) VALUES (
    NEW.id,
    auth.uid(),
    message_content,
    'SYSTEM'
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Failed to create task creation system message: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on tasks table for INSERT events
CREATE TRIGGER trigger_create_task_created_system_message
  AFTER INSERT ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.create_task_created_system_message();

-- Add comments
COMMENT ON FUNCTION public.create_task_created_system_message() IS 'Trigger function that creates SYSTEM messages when task is created';
COMMENT ON TRIGGER trigger_create_task_created_system_message ON public.tasks IS 'Automatically creates SYSTEM message when task is created (format: "업무가 할당되었습니다. (지시자: assigner, 담당자: assignee)")';

