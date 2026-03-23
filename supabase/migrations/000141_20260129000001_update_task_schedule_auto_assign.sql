-- ============================================================================
-- Update Task Schedule Auto-Assign Logic
-- 일정 자동 배정 로직 개선
-- ============================================================================
-- 마감일에 종일로 배정하는 대신 오전 9시~오후 7시 사이 가장 빠른 빈 시간에 1시간 배정
-- 마감일부터 시작하여 최대 30일까지 검색
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
  IF NEW.assignee_id IS NOT NULL AND NEW.due_date IS NOT NULL THEN
    target_date := DATE_TRUNC('day', NEW.due_date)::DATE;
    
    -- 마감일부터 시작하여 최대 30일까지 검색
    FOR day_offset IN 0..30 LOOP
      current_hour := start_hour;
      
      -- 오전 9시부터 오후 7시까지 1시간 단위로 검색
      WHILE current_hour < end_hour LOOP
        schedule_start := (target_date + day_offset * INTERVAL '1 day' + current_hour * INTERVAL '1 hour')::TIMESTAMPTZ;
        schedule_end := schedule_start + INTERVAL '1 hour';
        
        -- 해당 시간대에 기존 일정이 있는지 확인 (같은 담당자의 일정)
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

-- Add comments
COMMENT ON FUNCTION public.create_task_schedule() IS 'Trigger function that creates schedule when task is created. Assigns 1-hour slot between 9 AM and 7 PM on the earliest available day (up to 30 days from due_date)';
