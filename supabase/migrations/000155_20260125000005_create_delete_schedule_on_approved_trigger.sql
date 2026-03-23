-- Create trigger function to automatically delete schedule when task is approved

CREATE OR REPLACE FUNCTION public.delete_schedule_on_approved()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete schedule when task status changes to APPROVED
  IF NEW.task_status = 'APPROVED' AND (OLD.task_status IS NULL OR OLD.task_status != 'APPROVED') THEN
    DELETE FROM public.task_schedules WHERE task_id = NEW.id;
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Schedule deletion failure should not fail task update
    RAISE WARNING 'Failed to delete task schedule on approved: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on tasks table for UPDATE events
CREATE TRIGGER trigger_delete_schedule_on_approved
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_schedule_on_approved();

-- Add comments
COMMENT ON FUNCTION public.delete_schedule_on_approved() IS 'Trigger function that deletes schedule when task status changes to APPROVED';
COMMENT ON TRIGGER trigger_delete_schedule_on_approved ON public.tasks IS 'Automatically deletes schedule when task is approved';
