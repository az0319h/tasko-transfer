-- ============================================================================
-- Final Schedule Migrations - 통합 최종 마이그레이션 파일
-- 일정관리 자동 배정 및 승인 처리 관련 최종 통합 버전
-- ============================================================================
-- 이 파일은 schedule_end 폴더의 모든 마이그레이션을 통합한 최종 버전입니다.
-- DB 원본에 적용하기 위한 단일 SQL 파일입니다.
-- ============================================================================
-- 
-- 변경 사항 요약:
-- 1. 일정 자동 배정 로직 개선
--    - Task 생성 시 담당자에게 자동으로 일정 배정
--    - created_at 기준으로 일정 배정 (due_date 무관)
--    - 한국 시간대(KST) 기준으로 처리
--    - 현재 시간 이후만 배정 (과거 시간대 제외)
--    - 오전 9시~오후 7시 사이 빈 시간에 1시간 배정
--    - 최대 30일까지 검색
--
-- 2. APPROVED 상태 처리
--    - APPROVED 상태가 되어도 일정 유지 (종일로 변경하지 않음)
--    - 사용자가 드래그 앤 드롭하고 늘린 시간 그대로 유지
-- ============================================================================

-- ============================================================================
-- 1. 일정 자동 배정 함수 (최종 버전)
-- ============================================================================
-- Task 생성 시 담당자에게 자동으로 일정 배정
-- - created_at 기준 (한국 시간대)
-- - 현재 시간 이후만 배정
-- - 오전 9시~오후 7시 사이 빈 시간에 1시간 배정
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

-- ============================================================================
-- 2. 기존 트리거 정리 및 재생성
-- ============================================================================
-- create_task_schedule 트리거는 이미 존재할 수 있으므로
-- 기존 트리거를 제거하고 새로 생성
-- ============================================================================

-- 기존 트리거 제거 (있을 경우)
DROP TRIGGER IF EXISTS trigger_create_task_schedule ON public.tasks;

-- 새 트리거 생성
CREATE TRIGGER trigger_create_task_schedule
  AFTER INSERT ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.create_task_schedule();

COMMENT ON TRIGGER trigger_create_task_schedule ON public.tasks IS 'Automatically creates schedule when task is created with assignee. Assigns 1-hour slot between 9 AM and 7 PM KST on the earliest available day starting from task creation date (created_at).';

-- ============================================================================
-- 3. APPROVED 상태 트리거 제거
-- ============================================================================
-- APPROVED 상태가 되어도 일정이 그대로 유지되어야 함
-- 사용자가 드래그 앤 드롭하고 늘린 시간 그대로 유지
-- ============================================================================

-- 기존 APPROVED 관련 트리거 제거
DROP TRIGGER IF EXISTS trigger_delete_schedule_on_approved ON public.tasks;
DROP TRIGGER IF EXISTS trigger_update_schedule_on_approved ON public.tasks;

-- 기존 APPROVED 관련 함수 제거 (다른 곳에서 사용하지 않으므로)
DROP FUNCTION IF EXISTS public.update_schedule_on_approved();
DROP FUNCTION IF EXISTS public.delete_schedule_on_approved();

-- ============================================================================
-- 마이그레이션 완료
-- ============================================================================
-- 이 마이그레이션을 적용한 후:
-- 1. Task 생성 시 담당자에게 자동으로 일정이 배정됩니다.
-- 2. 일정은 한국 시간대 기준으로 현재 시간 이후만 배정됩니다.
-- 3. APPROVED 상태가 되어도 일정이 변경되지 않습니다.
-- ============================================================================
