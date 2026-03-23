-- ============================================================================
-- send_task_reference_email 함수 v_task 버그 수정
-- ============================================================================
-- 문제: FOR v_task IN (SELECT task_id ...) 후 SELECT INTO v_task로 덮어쓰면
--       v_task.task_id가 사라져 "record v_task has no field task_id" 오류 발생
-- 해결: 루프 변수를 v_task_id(UUID)로 분리, v_task는 Task 정보용으로만 사용
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
  v_http_response INTEGER;
  v_base_url TEXT;
BEGIN
  v_base_url := NULLIF(TRIM(current_setting('app.supabase_function_base_url', true)), '');
  IF v_base_url IS NULL OR v_base_url = '' THEN
    RAISE WARNING 'app.supabase_function_base_url가 설정되지 않았습니다. 참조자 이메일 발송을 건너뜁니다.';
    RETURN NULL;
  END IF;
  v_function_url := rtrim(v_base_url, '/') || '/send-task-reference-email';

  FOR v_task_id IN (
    SELECT DISTINCT task_id
    FROM inserted_references
  )
  LOOP
    SELECT id, title, client_name, due_date, assigner_id, assignee_id
    INTO v_task
    FROM public.tasks
    WHERE id = v_task_id;
    
    IF NOT FOUND THEN
      CONTINUE;
    END IF;
    
    SELECT email, COALESCE(full_name, email) as name
    INTO v_assigner_profile
    FROM public.profiles
    WHERE id = v_task.assigner_id;
    
    SELECT email, COALESCE(full_name, email) as name
    INTO v_assignee_profile
    FROM public.profiles
    WHERE id = v_task.assignee_id;
    
    SELECT jsonb_agg(
      jsonb_build_object(
        'email', p.email,
        'name', COALESCE(p.full_name, p.email)
      )
    )
    INTO v_reference_emails
    FROM inserted_references ir
    JOIN public.profiles p ON p.id = ir.user_id
    WHERE ir.task_id = v_task.id;
    
    IF v_reference_emails IS NULL OR jsonb_array_length(v_reference_emails) = 0 THEN
      CONTINUE;
    END IF;
    
    v_request_body := jsonb_build_object(
      'taskId', v_task.id::TEXT,
      'taskTitle', v_task.title,
      'taskDescription', v_task.title,
      'clientName', v_task.client_name,
      'dueDate', v_task.due_date::TEXT,
      'assignerName', v_assigner_profile.name,
      'assignerEmail', v_assigner_profile.email,
      'assigneeName', v_assignee_profile.name,
      'assigneeEmail', v_assignee_profile.email,
      'referenceEmails', v_reference_emails
    );
    
    v_service_role_key := current_setting('app.supabase_service_role_key', true);
    
    BEGIN
      SELECT status INTO v_http_response
      FROM net.http_post(
        url := v_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_role_key
        ),
        body := v_request_body
      );
      
      RAISE NOTICE 'Reference email Edge Function called for task %: status %', v_task.id, v_http_response;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to call reference email Edge Function for task %: %', v_task.id, SQLERRM;
    END;
  END LOOP;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
