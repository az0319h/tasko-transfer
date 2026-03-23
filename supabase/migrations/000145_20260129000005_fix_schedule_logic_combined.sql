-- ============================================================================
-- Combined Fix: Schedule Auto-Assign and Approved All-Day Logic
-- ?�정 ?�동 배정 �??�인 처리 로직 ?�합 ?�정
-- ============================================================================
-- 1. ?�정 ?�동 배정 기�?: due_date ??created_at
-- 2. ?�인 ??종일 변�?기�?: due_date ??기존 ?�정 ?�짜
-- ============================================================================

-- ============================================================================
-- 1. Fix Schedule Auto-Assign: Use created_at instead of due_date
-- ?�정 ?�동 배정 기�? ?�짜 ?�정: due_date ??created_at
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_task_schedule()
RETURNS TRIGGER AS $$
DECLARE
  target_date DATE;
  start_hour INT := 9;
  end_hour INT := 19;
  current_hour INT;
  found_slot BOOLEAN := false;
  schedule_start TIMESTAMPTZ;
  schedule_end TIMESTAMPTZ;
BEGIN
  -- assignee_id�??�인 (due_date 체크 ?�거)
  IF NEW.assignee_id IS NOT NULL THEN
    -- Task ?�성 ?�짜(created_at) 기�??�로 ?�정 배정
    target_date := DATE_TRUNC('day', NEW.created_at)::DATE;
    
    -- ?�성?��????�작?�여 최�? 30?�까지 검??
    FOR day_offset IN 0..30 LOOP
      current_hour := start_hour;
      
      -- ?�전 9?��????�후 7?�까지 1?�간 ?�위�?검??
      WHILE current_hour < end_hour LOOP
        schedule_start := (target_date + day_offset * INTERVAL '1 day' + current_hour * INTERVAL '1 hour')::TIMESTAMPTZ;
        schedule_end := schedule_start + INTERVAL '1 hour';
        
        -- ?�당 ?�간?�??기존 ?�정???�는지 ?�인 (같�? ?�당?�의 ?�정)
        IF NOT EXISTS (
          SELECT 1 
          FROM public.task_schedules ts
          INNER JOIN public.tasks t ON ts.task_id = t.id
          WHERE t.assignee_id = NEW.assignee_id
            AND ts.start_time < schedule_end
            AND ts.end_time > schedule_start
        ) THEN
          found_slot := true;
          EXIT;
        END IF;
        
        current_hour := current_hour + 1;
      END LOOP;
      
      IF found_slot THEN
        EXIT;
      END IF;
    END LOOP;
    
    IF found_slot THEN
      INSERT INTO public.task_schedules (task_id, start_time, end_time, is_all_day)
      VALUES (NEW.id, schedule_start, schedule_end, false);
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to create task schedule: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.create_task_schedule() IS 'Trigger function that creates schedule when task is created. Assigns 1-hour slot between 9 AM and 7 PM on the earliest available day starting from task creation date (created_at)';

-- ============================================================================
-- 2. Fix Approved Schedule All-Day: Use existing schedule date instead of due_date
-- ?�인 ??종일 변�?기�? ?�정: due_date ??기존 ?�정 ?�짜
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_schedule_on_approved()
RETURNS TRIGGER AS $$
DECLARE
  schedule_date_val DATE;
BEGIN
  -- Task ?�태가 APPROVED�?변경되?�을 ???�정??종일�?변�?
  IF NEW.task_status = 'APPROVED' AND (OLD.task_status IS NULL OR OLD.task_status != 'APPROVED') THEN
    -- ?�당 Task???�정???�는지 ?�인?�고 종일�?변�?
    IF EXISTS (SELECT 1 FROM public.task_schedules WHERE task_id = NEW.id) THEN
      -- 기존 ?�정???�짜�?기�??�로 종일�?변�?(due_date 무�?)
      SELECT DATE_TRUNC('day', start_time)::DATE INTO schedule_date_val
      FROM public.task_schedules
      WHERE task_id = NEW.id
      LIMIT 1;
      
      -- ?�정??종일�?변�?
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

COMMENT ON FUNCTION public.update_schedule_on_approved() IS 'Trigger function that updates schedule to all-day when task status changes to APPROVED. Uses existing schedule date instead of due_date';
COMMENT ON TRIGGER trigger_update_schedule_on_approved ON public.tasks IS 'Automatically updates schedule to all-day when task is approved, preserving the original schedule date';


-- 기존 ?�리�??�거 (?�정 ??�� ?�리�?�?기존 ?�데?�트 ?�리�?
DROP TRIGGER IF EXISTS trigger_delete_schedule_on_approved ON public.tasks;
DROP TRIGGER IF EXISTS trigger_update_schedule_on_approved ON public.tasks;

-- ?�로???�리�??�성 (?�정 종일 변�??�리�?
CREATE TRIGGER trigger_update_schedule_on_approved
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_schedule_on_approved();