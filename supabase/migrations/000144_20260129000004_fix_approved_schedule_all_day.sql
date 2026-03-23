-- ============================================================================
-- Fix Approved Schedule All-Day: Use existing schedule date instead of due_date
-- 승인 시 종일 변경 기준 수정: due_date → 기존 일정 날짜
-- ============================================================================
-- Task 승인 시 기존 일정의 날짜를 기준으로 종일로 변경
-- due_date와 무관하게 기존 일정이 있던 날짜를 유지
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_schedule_on_approved()
RETURNS TRIGGER AS $$
DECLARE
  schedule_date_val DATE;
BEGIN
  -- Task 상태가 APPROVED로 변경되었을 때 일정을 종일로 변경
  IF NEW.task_status = 'APPROVED' AND (OLD.task_status IS NULL OR OLD.task_status != 'APPROVED') THEN
    -- 해당 Task의 일정이 있는지 확인하고 종일로 변경
    IF EXISTS (SELECT 1 FROM public.task_schedules WHERE task_id = NEW.id) THEN
      -- 기존 일정의 날짜를 기준으로 종일로 변경 (due_date 무관)
      SELECT DATE_TRUNC('day', start_time)::DATE INTO schedule_date_val
      FROM public.task_schedules
      WHERE task_id = NEW.id
      LIMIT 1;
      
      -- 일정을 종일로 변경
      UPDATE public.task_schedules
      SET 
        start_time = schedule_date_val::TIMESTAMPTZ,
        end_time = (schedule_date_val + INTERVAL '1 day' - INTERVAL '1 second')::TIMESTAMPTZ,
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

-- Add comments
COMMENT ON FUNCTION public.update_schedule_on_approved() IS 'Trigger function that updates schedule to all-day when task status changes to APPROVED. Uses existing schedule date instead of due_date';
COMMENT ON TRIGGER trigger_update_schedule_on_approved ON public.tasks IS 'Automatically updates schedule to all-day when task is approved, preserving the original schedule date';
