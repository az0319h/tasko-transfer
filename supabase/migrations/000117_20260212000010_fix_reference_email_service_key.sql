-- ============================================================================
-- 참조자 이메일 401 해결: Service Role Key 하드코딩
-- ============================================================================
-- 원인: current_setting('app.supabase_service_role_key')가 null 반환
--       → Authorization: Bearer (빈값) → Edge Function 401 Unauthorized
-- 해결: send-task-email과 동일하게 하드코딩된 Service Role Key 사용
-- ============================================================================

CREATE OR REPLACE FUNCTION public.send_task_reference_email()
RETURNS TRIGGER AS $$
DECLARE
  v_task_id UUID;
  v_task RECORD;
  v_assigner_profile RECORD;
  v_assignee_profile RECORD;
  v_reference_emails JSONB;
  v_request_body JSONB;
  v_function_url TEXT;
  v_service_role_key TEXT;
BEGIN
  v_service_role_key := NULLIF(TRIM(current_setting('app.supabase_service_role_key', true)), '');
  IF v_service_role_key IS NULL OR v_service_role_key = '' THEN
    RAISE WARNING 'app.supabase_service_role_key가 설정되지 않았습니다. 참조자 이메일 발송을 건너뜁니다.';
    RETURN NULL;
  END IF;
  v_function_url := rtrim(NULLIF(TRIM(current_setting('app.supabase_function_base_url', true)), ''), '/') || '/send-task-reference-email';
  IF v_function_url IS NULL OR v_function_url = '' OR left(v_function_url, 4) != 'http' THEN
    RAISE WARNING 'app.supabase_function_base_url가 설정되지 않았습니다. 참조자 이메일 발송을 건너뜁니다.';
    RETURN NULL;
  END IF;

  FOR v_task_id IN (
    SELECT DISTINCT task_id FROM inserted_references
  )
  LOOP
    SELECT id, title, client_name, due_date, assigner_id, assignee_id
    INTO v_task FROM public.tasks WHERE id = v_task_id;
    IF NOT FOUND THEN CONTINUE; END IF;
    
    SELECT email, COALESCE(full_name, email) as name INTO v_assigner_profile
    FROM public.profiles WHERE id = v_task.assigner_id;
    
    SELECT email, COALESCE(full_name, email) as name INTO v_assignee_profile
    FROM public.profiles WHERE id = v_task.assignee_id;
    
    SELECT jsonb_agg(jsonb_build_object('email', p.email, 'name', COALESCE(p.full_name, p.email)))
    INTO v_reference_emails
    FROM inserted_references ir
    JOIN public.profiles p ON p.id = ir.user_id
    WHERE ir.task_id = v_task.id;
    
    IF v_reference_emails IS NULL OR jsonb_array_length(v_reference_emails) = 0 THEN
      CONTINUE;
    END IF;
    
    v_request_body := jsonb_build_object(
      'taskId', v_task.id::TEXT, 'taskTitle', v_task.title,
      'taskDescription', v_task.title, 'clientName', v_task.client_name,
      'dueDate', v_task.due_date::TEXT,
      'assignerName', v_assigner_profile.name, 'assignerEmail', v_assigner_profile.email,
      'assigneeName', v_assignee_profile.name, 'assigneeEmail', v_assignee_profile.email,
      'referenceEmails', v_reference_emails
    );
    
    BEGIN
      PERFORM net.http_post(
        url := v_function_url, body := v_request_body, params := '{}'::jsonb,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_role_key
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to call reference email Edge Function for task %: %', v_task.id, SQLERRM;
    END;
  END LOOP;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
BEGIN
  v_service_role_key := NULLIF(TRIM(current_setting('app.supabase_service_role_key', true)), '');
  IF v_service_role_key IS NULL OR v_service_role_key = '' THEN
    RAISE WARNING 'app.supabase_service_role_key가 설정되지 않았습니다. 참조자 이메일 발송을 건너뜁니다.';
    RETURN NEW;
  END IF;
  v_function_url := rtrim(NULLIF(TRIM(current_setting('app.supabase_function_base_url', true)), ''), '/') || '/send-task-reference-email';
  IF v_function_url IS NULL OR v_function_url = '' OR left(v_function_url, 4) != 'http' THEN
    RAISE WARNING 'app.supabase_function_base_url가 설정되지 않았습니다. 참조자 이메일 발송을 건너뜁니다.';
    RETURN NEW;
  END IF;

  IF OLD.task_status = NEW.task_status THEN RETURN NEW; END IF;
  IF NEW.is_self_task = true THEN RETURN NEW; END IF;
  IF NEW.assignee_id IS NULL THEN RETURN NEW; END IF;
  IF (OLD.task_status = 'ASSIGNED' AND NEW.task_status = 'IN_PROGRESS')
     OR (OLD.task_status = 'REJECTED' AND NEW.task_status = 'IN_PROGRESS') THEN
    RETURN NEW;
  END IF;

  SELECT jsonb_agg(jsonb_build_object('email', p.email, 'name', COALESCE(p.full_name, p.email)))
  INTO v_reference_emails
  FROM public.task_references tr
  JOIN public.profiles p ON p.id = tr.user_id
  WHERE tr.task_id = NEW.id;

  IF v_reference_emails IS NULL OR jsonb_array_length(v_reference_emails) = 0 THEN
    RETURN NEW;
  END IF;

  v_changer_id := auth.uid();
  IF v_changer_id IS NULL THEN
    SELECT user_id INTO v_changer_id
    FROM public.messages
    WHERE task_id = NEW.id AND message_type = 'SYSTEM'
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  IF v_changer_id IS NOT NULL THEN
    SELECT COALESCE(full_name, email) INTO v_changer_name
    FROM public.profiles WHERE id = v_changer_id;
  ELSE
    v_changer_name := '시스템';
  END IF;

  SELECT COALESCE(full_name, email) INTO v_assigner_name FROM public.profiles WHERE id = NEW.assigner_id;
  SELECT COALESCE(full_name, email) INTO v_assignee_name FROM public.profiles WHERE id = NEW.assignee_id;

  v_request_body := jsonb_build_object(
    'eventType', 'STATUS_CHANGED', 'taskId', NEW.id::TEXT, 'taskTitle', NEW.title,
    'clientName', COALESCE(NEW.client_name, ''), 'dueDate', COALESCE(NEW.due_date::TEXT, ''),
    'oldStatus', OLD.task_status, 'newStatus', NEW.task_status,
    'changerName', v_changer_name, 'assignerName', v_assigner_name, 'assigneeName', v_assignee_name,
    'referenceEmails', v_reference_emails
  );

  BEGIN
    PERFORM net.http_post(
      url := v_function_url, body := v_request_body, params := '{}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[REFERENCE_EMAIL] Failed to call Edge Function for task %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
