-- ============================================================================
-- 상태 변경 시 참조자에게 이메일 발송 트리거
-- ============================================================================
-- 목적: Task 상태가 변경될 때 참조자에게 send-task-reference-email 호출
-- send-task-email과 동일한 조건: 할당(진행), 완료요청, 승인, 거절, 재진행
-- 
-- 제외: ASSIGNED→IN_PROGRESS, REJECTED→IN_PROGRESS (send-task-email과 동일)
-- 제외: 자기 할당 Task(is_self_task=true), 참조자 0명
-- ============================================================================

CREATE OR REPLACE FUNCTION public.send_task_reference_email_on_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_reference_emails JSONB;
  v_request_body JSONB;
  v_function_url TEXT;
  v_service_role_key TEXT;
  v_assigner_name TEXT;
  v_assignee_name TEXT;
  v_changer_name TEXT;
  v_changer_id UUID;
  v_base_url TEXT;
BEGIN
  v_base_url := NULLIF(TRIM(current_setting('app.supabase_function_base_url', true)), '');
  IF v_base_url IS NULL OR v_base_url = '' THEN
    RAISE WARNING 'app.supabase_function_base_url가 설정되지 않았습니다. 참조자 이메일 발송을 건너뜁니다.';
    RETURN NEW;
  END IF;
  v_function_url := rtrim(v_base_url, '/') || '/send-task-reference-email';

  -- 상태가 변경되지 않으면 스킵
  IF OLD.task_status = NEW.task_status THEN
    RETURN NEW;
  END IF;

  -- 자기 할당 Task는 스킵
  IF NEW.is_self_task = true THEN
    RETURN NEW;
  END IF;

  -- 담당자가 없으면 스킵
  IF NEW.assignee_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- send-task-email과 동일: 특정 전환은 이메일 스킵
  IF (OLD.task_status = 'ASSIGNED' AND NEW.task_status = 'IN_PROGRESS')
     OR (OLD.task_status = 'REJECTED' AND NEW.task_status = 'IN_PROGRESS') THEN
    RETURN NEW;
  END IF;

  -- 참조자 목록 조회 (task_references + profiles)
  SELECT jsonb_agg(
    jsonb_build_object(
      'email', p.email,
      'name', COALESCE(p.full_name, p.email)
    )
  )
  INTO v_reference_emails
  FROM public.task_references tr
  JOIN public.profiles p ON p.id = tr.user_id
  WHERE tr.task_id = NEW.id;

  -- 참조자가 없으면 스킵
  IF v_reference_emails IS NULL OR jsonb_array_length(v_reference_emails) = 0 THEN
    RETURN NEW;
  END IF;

  -- 변경자 정보 (auth.uid() 또는 messages에서 최근 시스템 메시지 작성자)
  v_changer_id := auth.uid();
  IF v_changer_id IS NULL THEN
    SELECT user_id INTO v_changer_id
    FROM public.messages
    WHERE task_id = NEW.id
      AND message_type = 'SYSTEM'
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF v_changer_id IS NOT NULL THEN
    SELECT COALESCE(full_name, email) INTO v_changer_name
    FROM public.profiles
    WHERE id = v_changer_id;
  ELSE
    v_changer_name := '시스템';
  END IF;

  -- 지시자/담당자 이름
  SELECT COALESCE(full_name, email) INTO v_assigner_name
  FROM public.profiles WHERE id = NEW.assigner_id;

  SELECT COALESCE(full_name, email) INTO v_assignee_name
  FROM public.profiles WHERE id = NEW.assignee_id;

  -- Edge Function 요청 본문
  v_request_body := jsonb_build_object(
    'eventType', 'STATUS_CHANGED',
    'taskId', NEW.id::TEXT,
    'taskTitle', NEW.title,
    'clientName', COALESCE(NEW.client_name, ''),
    'dueDate', COALESCE(NEW.due_date::TEXT, ''),
    'oldStatus', OLD.task_status,
    'newStatus', NEW.task_status,
    'changerName', v_changer_name,
    'assignerName', v_assigner_name,
    'assigneeName', v_assignee_name,
    'referenceEmails', v_reference_emails
  );

  v_service_role_key := current_setting('app.supabase_service_role_key', true);

  BEGIN
    PERFORM net.http_post(
      url := v_function_url,
      body := v_request_body,
      params := '{}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key
      )
    );
    RAISE NOTICE '[REFERENCE_EMAIL] Status change notification sent for task %: % -> %', NEW.id, OLD.task_status, NEW.task_status;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING '[REFERENCE_EMAIL] Failed to call Edge Function for task %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.send_task_reference_email_on_status_change() IS
'Task 상태 변경 시 참조자에게 이메일 발송. send-task-reference-email Edge Function 호출. ASSIGNED→IN_PROGRESS, REJECTED→IN_PROGRESS 제외.';

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_send_reference_email_on_status_change ON public.tasks;

CREATE TRIGGER trigger_send_reference_email_on_status_change
  AFTER UPDATE OF task_status ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.send_task_reference_email_on_status_change();

COMMENT ON TRIGGER trigger_send_reference_email_on_status_change ON public.tasks IS
'Task 상태 변경 시 참조자에게 send-task-reference-email로 이메일 발송.';
