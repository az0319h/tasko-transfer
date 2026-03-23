-- =====================================================
-- 개인 태스크 기능 구현 통합 마이그레이션
-- 1. is_self_task 컬럼 추가
-- 2. 제약조건 수정
-- 3. RLS 정책 수정
-- 4. 인덱스 추가
-- 5. 이메일/캘린더 트리거 함수 수정
-- 6. 알림 트리거 함수 수정
-- =====================================================

-- 1. is_self_task 컬럼 추가
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS is_self_task BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tasks.is_self_task IS '자기 자신에게 할당하는 독립적인 Task 여부';

-- 2. 제약조건 추가: is_self_task = true일 때만 assigner_id = assignee_id 허용
ALTER TABLE public.tasks
ADD CONSTRAINT check_self_task_assignment 
CHECK (
  (is_self_task = true AND assigner_id = assignee_id) OR
  (is_self_task = false AND assigner_id != assignee_id)
);

COMMENT ON CONSTRAINT check_self_task_assignment ON public.tasks IS 
'is_self_task = true일 때만 자기 할당 허용, false일 때는 자기 할당 불가';

-- 3. RLS 정책 수정

-- 3.1 SELECT 정책 수정: 자기 할당 Task는 본인만 접근 가능 (관리자도 제외)
DROP POLICY IF EXISTS tasks_select_admin_or_assigned ON public.tasks;

CREATE POLICY tasks_select_admin_or_assigned ON public.tasks
FOR SELECT
USING (
  -- 자기 할당 Task: 본인만 접근 가능 (관리자도 제외)
  (is_self_task = true AND auth.uid() = assigner_id) OR
  -- 일반 Task: 기존 정책 유지 (관리자 또는 지시자/담당자)
  (is_self_task = false AND (
    is_admin(auth.uid()) OR 
    auth.uid() = assigner_id OR 
    auth.uid() = assignee_id
  ))
);

-- 3.2 DELETE 정책 수정: 자기 할당 Task는 본인만 삭제 가능
DROP POLICY IF EXISTS tasks_delete_assigner_only ON public.tasks;

CREATE POLICY tasks_delete_assigner_only ON public.tasks
FOR DELETE
USING (
  -- 자기 할당 Task: 본인만 삭제 가능
  (is_self_task = true AND auth.uid() = assigner_id) OR
  -- 일반 Task: 관리자만 삭제 가능 (기존 정책)
  (is_self_task = false AND auth.uid() = assigner_id)
);

-- 3.3 UPDATE 정책 수정: 자기 할당 Task는 본인만 수정 가능
DROP POLICY IF EXISTS tasks_update_assigner_or_assignee ON public.tasks;

CREATE POLICY tasks_update_assigner_or_assignee ON public.tasks
FOR UPDATE
USING (
  -- 자기 할당 Task: 본인만 수정 가능
  (is_self_task = true AND auth.uid() = assigner_id) OR
  -- 일반 Task: 지시자 또는 담당자만 수정 가능
  (is_self_task = false AND (auth.uid() = assigner_id OR auth.uid() = assignee_id))
)
WITH CHECK (
  -- 자기 할당 Task: 본인만 수정 가능
  (is_self_task = true AND auth.uid() = assigner_id) OR
  -- 일반 Task: 지시자 또는 담당자만 수정 가능
  (is_self_task = false AND (auth.uid() = assigner_id OR auth.uid() = assignee_id))
);

-- 4. 인덱스 추가: 자기 할당 Task 조회 최적화
CREATE INDEX IF NOT EXISTS idx_tasks_is_self_task 
ON public.tasks(is_self_task) 
WHERE is_self_task = true;

CREATE INDEX IF NOT EXISTS idx_tasks_self_task_user 
ON public.tasks(assigner_id, is_self_task) 
WHERE is_self_task = true;

-- 5. 이메일 트리거 함수 수정

-- 5.1 send_task_created_email: is_self_task = true일 때 early return
CREATE OR REPLACE FUNCTION public.send_task_created_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  assigner_email TEXT;
  assignee_email TEXT;
  assigner_name TEXT;
  assignee_name TEXT;
  client_name TEXT;
  request_body JSONB;
  function_url TEXT;
  service_role_key TEXT;
  http_response_id BIGINT;
BEGIN
  -- 자기 할당 Task는 이메일 발송하지 않음
  IF NEW.is_self_task = true THEN
    RETURN NEW;
  END IF;

  -- 로깅: 트리거 실행 확인
  RAISE NOTICE '[EMAIL_TRIGGER] Task created: %', NEW.id;

  -- Get assigner and assignee emails and names from profiles
  SELECT email, COALESCE(full_name, email) INTO assigner_email, assigner_name
  FROM public.profiles
  WHERE id = NEW.assigner_id;

  SELECT email, COALESCE(full_name, email) INTO assignee_email, assignee_name
  FROM public.profiles
  WHERE id = NEW.assignee_id;

  -- Validate email addresses
  IF assigner_email IS NULL OR assignee_email IS NULL THEN
    RAISE WARNING '[EMAIL_TRIGGER] Missing email addresses: assigner=%, assignee=%', 
      assigner_email, assignee_email;
    RETURN NEW;
  END IF;

  -- Get client_name from task (project_id 대신 사용)
  client_name := NEW.client_name;

  -- Build request body for Edge Function
  request_body := jsonb_build_object(
    'eventType', 'TASK_CREATED',
    'taskId', NEW.id::TEXT,
    'assignerEmail', assigner_email,
    'assigneeEmail', assignee_email,
    'assignerName', assigner_name,
    'assigneeName', assignee_name,
    'taskTitle', NEW.title,
    'clientName', COALESCE(client_name, ''),
    'dueDate', COALESCE(NEW.due_date::TEXT, ''),
    'recipients', ARRAY['assigner', 'assignee']
  );

  -- Edge Function URL: DB 설정에서 로드 (ALTER DATABASE postgres SET app.supabase_function_base_url = 'https://your-project.supabase.co/functions/v1';)
  function_url := rtrim(NULLIF(TRIM(current_setting('app.supabase_function_base_url', true)), ''), '/') || '/send-task-email';
  IF function_url IS NULL OR function_url = '' OR left(function_url, 4) != 'http' THEN
    RAISE WARNING 'app.supabase_function_base_url가 설정되지 않았습니다. 이메일 발송을 건너뜁니다.';
    RETURN NEW;
  END IF;

  -- Service Role Key: DB 설정에서 로드 (ALTER DATABASE postgres SET app.supabase_service_role_key = 'your-key';)
  service_role_key := NULLIF(TRIM(current_setting('app.supabase_service_role_key', true)), '');
  IF service_role_key IS NULL OR service_role_key = '' THEN
    RAISE WARNING 'app.supabase_service_role_key가 설정되지 않았습니다. 이메일 발송을 건너뜁니다.';
    RETURN NEW;
  END IF;

  RAISE NOTICE '[EMAIL_TRIGGER] Calling Edge Function: %', function_url;
  RAISE NOTICE '[EMAIL_TRIGGER] Request body: %', request_body;

  -- Call Edge Function via HTTP (non-blocking)
  SELECT net.http_post(
    url := function_url,
    body := request_body,
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', format('Bearer %s', service_role_key)
    )
  ) INTO http_response_id;

  RAISE NOTICE '[EMAIL_TRIGGER] HTTP request submitted with ID: %', http_response_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[EMAIL_TRIGGER] Failed to send task creation email notification: %', SQLERRM;
    RAISE WARNING '[EMAIL_TRIGGER] Error details: %', SQLSTATE;
    RETURN NEW;
END;
$function$;

-- 5.2 send_task_status_change_email: is_self_task = true일 때 early return
CREATE OR REPLACE FUNCTION public.send_task_status_change_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  assigner_email TEXT;
  assignee_email TEXT;
  assigner_name TEXT;
  assignee_name TEXT;
  changer_name TEXT;
  changer_id UUID;
  client_name TEXT;
  recipients_array TEXT[];
  request_body JSONB;
  function_url TEXT;
  service_role_key TEXT;
  http_response_id BIGINT;
BEGIN
  -- 자기 할당 Task는 이메일 발송하지 않음
  IF NEW.is_self_task = true THEN
    RETURN NEW;
  END IF;

  -- 로깅: 트리거 실행 확인
  RAISE NOTICE '[EMAIL_TRIGGER] Status changed: % -> % (task: %)', 
    OLD.task_status, NEW.task_status, NEW.id;

  -- Only trigger for specific status transitions
  IF OLD.task_status = NEW.task_status THEN
    RAISE NOTICE '[EMAIL_TRIGGER] Status unchanged, skipping';
    RETURN NEW;
  END IF;

  -- Check if this is a valid status transition that requires email
  IF NOT (
    (OLD.task_status = 'ASSIGNED' AND NEW.task_status = 'IN_PROGRESS') OR
    (OLD.task_status = 'IN_PROGRESS' AND NEW.task_status = 'WAITING_CONFIRM') OR
    (NEW.task_status IN ('APPROVED', 'REJECTED') AND OLD.task_status = 'WAITING_CONFIRM') OR
    (OLD.task_status = 'REJECTED' AND NEW.task_status = 'IN_PROGRESS')
  ) THEN
    RAISE NOTICE '[EMAIL_TRIGGER] Status transition not eligible for email: % -> %', 
      OLD.task_status, NEW.task_status;
    RETURN NEW;
  END IF;

  -- Get assigner and assignee emails and names from profiles
  SELECT email, COALESCE(full_name, email) INTO assigner_email, assigner_name
  FROM public.profiles
  WHERE id = NEW.assigner_id;

  SELECT email, COALESCE(full_name, email) INTO assignee_email, assignee_name
  FROM public.profiles
  WHERE id = NEW.assignee_id;

  -- Validate email addresses
  IF assigner_email IS NULL OR assignee_email IS NULL THEN
    RAISE WARNING '[EMAIL_TRIGGER] Missing email addresses: assigner=%, assignee=%', 
      assigner_email, assignee_email;
    RETURN NEW;
  END IF;

  -- Get changer name (user who triggered the status change)
  changer_id := auth.uid();
  IF changer_id IS NULL THEN
    -- 시스템 메시지에서 최근 변경자 조회 시도
    SELECT user_id INTO changer_id
    FROM messages
    WHERE task_id = NEW.id
      AND message_type = 'SYSTEM'
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF changer_id IS NULL THEN
      changer_name := '시스템';
    ELSE
      SELECT COALESCE(full_name, email) INTO changer_name
      FROM public.profiles
      WHERE id = changer_id;
    END IF;
  ELSE
    SELECT COALESCE(full_name, email) INTO changer_name
    FROM public.profiles
    WHERE id = changer_id;
  END IF;

  -- Get client_name from task (project_id 대신 사용)
  client_name := NEW.client_name;

  -- Determine recipients based on status transition
  IF OLD.task_status = 'ASSIGNED' AND NEW.task_status = 'IN_PROGRESS' THEN
    recipients_array := ARRAY['assigner', 'assignee'];
  ELSIF OLD.task_status = 'IN_PROGRESS' AND NEW.task_status = 'WAITING_CONFIRM' THEN
    recipients_array := ARRAY['assigner'];
  ELSIF OLD.task_status = 'WAITING_CONFIRM' AND NEW.task_status IN ('APPROVED', 'REJECTED') THEN
    recipients_array := ARRAY['assignee'];
  ELSIF OLD.task_status = 'REJECTED' AND NEW.task_status = 'IN_PROGRESS' THEN
    recipients_array := ARRAY['assigner'];
  ELSE
    recipients_array := ARRAY['assigner', 'assignee'];
  END IF;

  RAISE NOTICE '[EMAIL_TRIGGER] Recipients: %', recipients_array;

  -- Build request body for Edge Function
  request_body := jsonb_build_object(
    'eventType', 'STATUS_CHANGED',
    'taskId', NEW.id::TEXT,
    'oldStatus', OLD.task_status,
    'newStatus', NEW.task_status,
    'assignerEmail', assigner_email,
    'assigneeEmail', assignee_email,
    'assignerName', assigner_name,
    'assigneeName', assignee_name,
    'changerId', COALESCE(changer_id::TEXT, ''),
    'changerName', changer_name,
    'taskTitle', NEW.title,
    'clientName', COALESCE(client_name, ''),
    'dueDate', COALESCE(NEW.due_date::TEXT, ''),
    'recipients', recipients_array
  );

  -- Edge Function URL: DB 설정에서 로드 (ALTER DATABASE postgres SET app.supabase_function_base_url = 'https://your-project.supabase.co/functions/v1';)
  function_url := rtrim(NULLIF(TRIM(current_setting('app.supabase_function_base_url', true)), ''), '/') || '/send-task-email';
  IF function_url IS NULL OR function_url = '' OR left(function_url, 4) != 'http' THEN
    RAISE WARNING 'app.supabase_function_base_url가 설정되지 않았습니다. 이메일 발송을 건너뜁니다.';
    RETURN NEW;
  END IF;

  -- Service Role Key: DB 설정에서 로드 (ALTER DATABASE postgres SET app.supabase_service_role_key = 'your-key';)
  service_role_key := NULLIF(TRIM(current_setting('app.supabase_service_role_key', true)), '');
  IF service_role_key IS NULL OR service_role_key = '' THEN
    RAISE WARNING 'app.supabase_service_role_key가 설정되지 않았습니다. 이메일 발송을 건너뜁니다.';
    RETURN NEW;
  END IF;

  RAISE NOTICE '[EMAIL_TRIGGER] Calling Edge Function: %', function_url;
  RAISE NOTICE '[EMAIL_TRIGGER] Request body: %', request_body;

  -- Call Edge Function via HTTP (non-blocking)
  SELECT net.http_post(
    url := function_url,
    body := request_body,
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', format('Bearer %s', service_role_key)
    )
  ) INTO http_response_id;

  RAISE NOTICE '[EMAIL_TRIGGER] HTTP request submitted with ID: %', http_response_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[EMAIL_TRIGGER] Failed to send email notification: %', SQLERRM;
    RAISE WARNING '[EMAIL_TRIGGER] Error details: %', SQLSTATE;
    RETURN NEW;
END;
$function$;

-- 5.3 create_task_schedule: is_self_task = true일 때 early return
CREATE OR REPLACE FUNCTION public.create_task_schedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
  day_of_week INT;
BEGIN
  -- 자기 할당 Task는 캘린더 일정 생성하지 않음
  IF NEW.is_self_task = true THEN
    RETURN NEW;
  END IF;

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
      
      -- 주말 체크: 토요일(6) 또는 일요일(0)이면 스킵
      day_of_week := EXTRACT(DOW FROM schedule_date)::INT;
      IF day_of_week = 0 OR day_of_week = 6 THEN
        CONTINUE;
      END IF;
      
      current_hour := start_hour;
      
      -- 오전 9시부터 오후 7시까지 1시간 단위로 검색 (한국 시간 기준)
      WHILE current_hour < end_hour LOOP
        -- 현재 시간보다 이전 시간대는 제외
        IF schedule_date = current_date_kst THEN
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
$function$;

-- 6. 알림 트리거 함수 수정

-- 6.1 create_task_created_notification: is_self_task = true일 때 early return
CREATE OR REPLACE FUNCTION public.create_task_created_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_assignee_name TEXT;
  v_task_title TEXT;
BEGIN
  -- 자기 할당 Task는 알림 생성하지 않음
  IF NEW.is_self_task = true THEN
    RETURN NEW;
  END IF;

  -- 담당자가 없는 경우 알림 생성하지 않음
  IF NEW.assignee_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 담당자 이름 조회
  SELECT COALESCE(full_name, email) INTO v_assignee_name
  FROM public.profiles
  WHERE id = NEW.assignee_id;

  -- Task 제목
  v_task_title := NEW.title;

  -- 담당자에게 Task 생성 알림 생성
  PERFORM public.create_notification(
    p_user_id := NEW.assignee_id,
    p_notification_type := 'TASK_CREATED',
    p_title := '새 Task가 배정되었습니다',
    p_message := format('%s Task가 배정되었습니다.', v_task_title),
    p_task_id := NEW.id,
    p_metadata := jsonb_build_object(
      'task_title', v_task_title,
      'assigner_id', NEW.assigner_id
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- 알림 생성 실패해도 Task 생성은 성공해야 함
    RAISE WARNING 'Failed to create task created notification: %', SQLERRM;
    RETURN NEW;
END;
$function$;

-- 6.2 create_task_status_changed_notification: is_self_task = true일 때 early return
CREATE OR REPLACE FUNCTION public.create_task_status_changed_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_assigner_name TEXT;
  v_assignee_name TEXT;
  v_task_title TEXT;
  v_status_label TEXT;
BEGIN
  -- 자기 할당 Task는 알림 생성하지 않음
  IF NEW.is_self_task = true THEN
    RETURN NEW;
  END IF;

  -- 상태가 변경되지 않은 경우 알림 생성하지 않음
  IF OLD.task_status = NEW.task_status THEN
    RETURN NEW;
  END IF;

  -- 담당자가 없는 경우 알림 생성하지 않음
  IF NEW.assignee_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 상태 라벨 매핑
  v_status_label := CASE NEW.task_status
    WHEN 'ASSIGNED' THEN '할당됨'
    WHEN 'IN_PROGRESS' THEN '진행중'
    WHEN 'WAITING_CONFIRM' THEN '확인대기'
    WHEN 'APPROVED' THEN '승인됨'
    WHEN 'REJECTED' THEN '거부됨'
    ELSE NEW.task_status::TEXT
  END;

  -- 지시자 이름 조회
  SELECT COALESCE(full_name, email) INTO v_assigner_name
  FROM public.profiles
  WHERE id = NEW.assigner_id;

  -- 담당자 이름 조회
  SELECT COALESCE(full_name, email) INTO v_assignee_name
  FROM public.profiles
  WHERE id = NEW.assignee_id;

  -- Task 제목
  v_task_title := NEW.title;

  -- 상태 변경 알림 생성 (담당자에게)
  PERFORM public.create_notification(
    p_user_id := NEW.assignee_id,
    p_notification_type := 'TASK_STATUS_CHANGED',
    p_title := format('Task 상태가 변경되었습니다 (%s)', v_status_label),
    p_message := format('%s Task의 상태가 %s로 변경되었습니다.', v_task_title, v_status_label),
    p_task_id := NEW.id,
    p_metadata := jsonb_build_object(
      'task_title', v_task_title,
      'old_status', OLD.task_status,
      'new_status', NEW.task_status,
      'assigner_id', NEW.assigner_id
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- 알림 생성 실패해도 Task 상태 변경은 성공해야 함
    RAISE WARNING 'Failed to create task status changed notification: %', SQLERRM;
    RETURN NEW;
END;
$function$;

-- 6.3 create_task_deleted_notification: is_self_task = true일 때 early return
CREATE OR REPLACE FUNCTION public.create_task_deleted_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_assignee_name TEXT;
  v_task_title TEXT;
BEGIN
  -- 자기 할당 Task는 알림 생성하지 않음
  IF OLD.is_self_task = true THEN
    RETURN OLD;
  END IF;

  -- 담당자가 없는 경우 알림 생성하지 않음
  IF OLD.assignee_id IS NULL THEN
    RETURN OLD;
  END IF;

  -- 담당자 이름 조회 (Task 생성 알림과 동일한 패턴)
  SELECT COALESCE(full_name, email) INTO v_assignee_name
  FROM public.profiles
  WHERE id = OLD.assignee_id;

  -- Task 제목
  v_task_title := OLD.title;

  -- 담당자에게 Task 삭제 알림 생성
  PERFORM public.create_notification(
    p_user_id := OLD.assignee_id,
    p_notification_type := 'TASK_DELETED',
    p_title := 'Task가 삭제되었습니다',
    p_message := format('%s Task가 삭제되었습니다.', v_task_title),
    p_task_id := NULL,
    p_metadata := jsonb_build_object(
      'task_title', v_task_title,
      'task_id', OLD.id,
      'assigner_id', OLD.assigner_id
    )
  );

  RETURN OLD;
EXCEPTION
  WHEN OTHERS THEN
    -- 알림 생성 실패해도 Task 삭제는 성공해야 함
    RAISE WARNING 'Failed to create task deleted notification: %', SQLERRM;
    RETURN OLD;
END;
$function$;
