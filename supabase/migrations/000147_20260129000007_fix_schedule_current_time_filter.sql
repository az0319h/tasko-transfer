-- ============================================================================
-- Fix Schedule Current Time Filter: Only assign schedules after current time
-- 일정 배정 시 현재 시간 이후만 배정하도록 수정
-- ============================================================================
-- 현재 시간(KST)을 확인하여 과거 시간대는 제외하고 배정
-- 예: 현재 14:28이면 15:00부터 검색 시작 (14:00~14:59는 모두 제외)
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
  created_at_kst TIMESTAMP;
  current_time_kst TIMESTAMP;
  current_date_kst DATE;
  current_hour_kst INT;
  schedule_date DATE;
BEGIN
  -- assignee_id만 확인 (due_date 체크 제거)
  IF NEW.assignee_id IS NOT NULL THEN
    -- 현재 시간을 한국 시간대(KST)로 가져오기
    current_time_kst := NOW() AT TIME ZONE 'Asia/Seoul';
    current_date_kst := DATE_TRUNC('day', current_time_kst)::DATE;
    current_hour_kst := EXTRACT(HOUR FROM current_time_kst)::INT;
    
    -- Task 생성 날짜(created_at)를 한국 시간대(KST)로 변환
    created_at_kst := NEW.created_at AT TIME ZONE 'Asia/Seoul';
    target_date := DATE_TRUNC('day', created_at_kst)::DATE;
    
    -- 생성일부터 시작하여 최대 30일까지 검색
    FOR day_offset IN 0..30 LOOP
      schedule_date := (target_date + day_offset * INTERVAL '1 day')::DATE;
      current_hour := start_hour;
      
      -- 오전 9시부터 오후 7시까지 1시간 단위로 검색 (한국 시간 기준)
      WHILE current_hour < end_hour LOOP
        -- 현재 시간보다 이전 시간대는 제외
        -- 같은 날짜인 경우: 현재 시간 이후만 허용
        IF schedule_date = current_date_kst THEN
          -- 같은 날짜이고, 현재 시간보다 이전 시간대면 스킵
          -- 예: 현재 14:28이면 14:00은 제외, 15:00부터 허용
          IF current_hour <= current_hour_kst THEN
            current_hour := current_hour + 1;
            CONTINUE;
          END IF;
        END IF;
        
        -- 한국 시간대로 일정 시간 생성 (UTC로 변환하여 저장)
        schedule_start := ((schedule_date + current_hour * INTERVAL '1 hour')::TIMESTAMP AT TIME ZONE 'Asia/Seoul')::TIMESTAMPTZ;
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

COMMENT ON FUNCTION public.create_task_schedule() IS 'Trigger function that creates schedule when task is created. Assigns 1-hour slot between 9 AM and 7 PM KST on the earliest available day starting from task creation date (created_at). Only assigns schedules after current time (KST) - excludes past time slots on the same day.';
