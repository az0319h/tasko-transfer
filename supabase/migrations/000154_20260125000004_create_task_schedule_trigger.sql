-- Create trigger function to automatically create schedule when task is created
-- Creates schedule for any assignee (담당자에게 자동으로 일정 생성)

CREATE OR REPLACE FUNCTION public.create_task_schedule()
RETURNS TRIGGER AS $$
BEGIN
  -- 담당자(assignee)가 있고 due_date가 있으면 일정 생성
  -- Task를 생성한 사용자가 누구인지와 관계없이 담당자에게 일정 생성
  IF NEW.assignee_id IS NOT NULL AND NEW.due_date IS NOT NULL THEN
    INSERT INTO public.task_schedules (task_id, start_time, end_time, is_all_day)
    VALUES (
      NEW.id,
      DATE_TRUNC('day', NEW.due_date)::TIMESTAMPTZ,
      (DATE_TRUNC('day', NEW.due_date) + INTERVAL '1 day' - INTERVAL '1 second')::TIMESTAMPTZ,
      true
    );
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Schedule creation failure should not fail task creation
    RAISE WARNING 'Failed to create task schedule: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on tasks table for INSERT events
CREATE TRIGGER trigger_create_task_schedule
  AFTER INSERT ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.create_task_schedule();

-- Add comments
COMMENT ON FUNCTION public.create_task_schedule() IS 'Trigger function that creates schedule when task is created (for any assignee with due_date)';
COMMENT ON TRIGGER trigger_create_task_schedule ON public.tasks IS 'Automatically creates schedule when task is created with assignee and due_date';
