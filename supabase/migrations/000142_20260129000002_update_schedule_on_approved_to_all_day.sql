-- ============================================================================
-- Update Schedule on Task Approved to All-Day
-- Task 승인 시 일정을 삭제하는 대신 종일로 변경
-- ============================================================================
-- 기존 delete_schedule_on_approved 트리거를 제거하고
-- 새로운 update_schedule_on_approved 트리거로 교체
-- ============================================================================

-- 새로운 트리거 함수: Task 승인 시 일정을 종일로 변경
CREATE OR REPLACE FUNCTION public.update_schedule_on_approved()
RETURNS TRIGGER AS $$
DECLARE
  due_date_val DATE;
BEGIN
  -- Task 상태가 APPROVED로 변경되었을 때 일정을 종일로 변경
  IF NEW.task_status = 'APPROVED' AND (OLD.task_status IS NULL OR OLD.task_status != 'APPROVED') THEN
    -- 해당 Task의 일정이 있는지 확인하고 종일로 변경
    IF EXISTS (SELECT 1 FROM public.task_schedules WHERE task_id = NEW.id) THEN
      -- 마감일이 있으면 마감일을 기준으로 종일로 변경
      IF NEW.due_date IS NOT NULL THEN
        due_date_val := DATE_TRUNC('day', NEW.due_date)::DATE;
      ELSE
        -- 마감일이 없으면 기존 일정의 날짜를 기준으로 종일로 변경
        SELECT DATE_TRUNC('day', start_time)::DATE INTO due_date_val
        FROM public.task_schedules
        WHERE task_id = NEW.id
        LIMIT 1;
      END IF;
      
      -- 일정을 종일로 변경
      UPDATE public.task_schedules
      SET 
        start_time = due_date_val::TIMESTAMPTZ,
        end_time = (due_date_val + INTERVAL '1 day' - INTERVAL '1 second')::TIMESTAMPTZ,
        is_all_day = true,
        updated_at = NOW()
      WHERE task_id = NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to update task schedule on approved: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 기존 트리거 제거
DROP TRIGGER IF EXISTS trigger_delete_schedule_on_approved ON public.tasks;

-- 새로운 트리거 생성
CREATE TRIGGER trigger_update_schedule_on_approved
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_schedule_on_approved();

-- Add comments
COMMENT ON FUNCTION public.update_schedule_on_approved() IS 'Trigger function that updates schedule to all-day when task status changes to APPROVED';
COMMENT ON TRIGGER trigger_update_schedule_on_approved ON public.tasks IS 'Automatically updates schedule to all-day when task is approved';
