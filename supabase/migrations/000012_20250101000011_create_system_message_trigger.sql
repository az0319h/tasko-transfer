-- Database Trigger: Automatically create SYSTEM message when task status changes
-- This trigger creates a SYSTEM type message in the messages table when task_status changes

CREATE OR REPLACE FUNCTION public.create_task_status_change_system_message()
RETURNS TRIGGER AS $$
DECLARE
  changer_name TEXT;
  old_status_label TEXT;
  new_status_label TEXT;
  message_content TEXT;
BEGIN
  -- Only trigger if status actually changed
  IF OLD.task_status = NEW.task_status THEN
    RETURN NEW;
  END IF;

  -- Get changer name (user who triggered the status change)
  SELECT COALESCE(full_name, email) INTO changer_name
  FROM public.profiles
  WHERE id = auth.uid();

  -- Map status codes to Korean labels
  old_status_label := CASE OLD.task_status
    WHEN 'ASSIGNED' THEN '할당됨'
    WHEN 'IN_PROGRESS' THEN '진행 중'
    WHEN 'WAITING_CONFIRM' THEN '확인 대기'
    WHEN 'APPROVED' THEN '승인됨'
    WHEN 'REJECTED' THEN '거부됨'
    ELSE OLD.task_status
  END;

  new_status_label := CASE NEW.task_status
    WHEN 'ASSIGNED' THEN '할당됨'
    WHEN 'IN_PROGRESS' THEN '진행 중'
    WHEN 'WAITING_CONFIRM' THEN '확인 대기'
    WHEN 'APPROVED' THEN '승인됨'
    WHEN 'REJECTED' THEN '거부됨'
    ELSE NEW.task_status
  END;

  -- Create system message content
  message_content := format(
    '상태가 %s에서 %s로 변경되었습니다. (변경자: %s)',
    old_status_label,
    new_status_label,
    changer_name
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
    RAISE WARNING 'Failed to create system message: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on tasks table
CREATE TRIGGER trigger_create_task_status_change_system_message
  AFTER UPDATE OF task_status ON public.tasks
  FOR EACH ROW
  WHEN (OLD.task_status IS DISTINCT FROM NEW.task_status)
  EXECUTE FUNCTION public.create_task_status_change_system_message();

-- Add comment
COMMENT ON FUNCTION public.create_task_status_change_system_message() IS 'Trigger function that creates SYSTEM messages when task status changes';
COMMENT ON TRIGGER trigger_create_task_status_change_system_message ON public.tasks IS 'Automatically creates SYSTEM message when task status changes';

