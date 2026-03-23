-- ============================================================================
-- Phase 4: 참조자 전용 Edge Function 및 트리거
-- ============================================================================
-- 목적: task_references INSERT 시 참조자에게 이메일 발송
-- 
-- 작업 내용:
-- 1. send_task_reference_email 함수 생성 (트리거 함수)
-- 2. trigger_send_reference_email 트리거 생성 (AFTER INSERT ON task_references)
-- 
-- 중복 발송 방지:
-- - FOR EACH STATEMENT 방식 사용
-- - Task 생성 시 참조자 3명 추가 → 이메일 1회 발송 (참조자 목록 배치 전송)
-- - transition table (NEW TABLE AS inserted_references) 사용
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. send_task_reference_email 함수 생성
-- ----------------------------------------------------------------------------
-- Task에 참조자가 추가되었을 때 이메일 발송
-- FOR EACH STATEMENT로 호출되어 같은 Task에 대한 모든 참조자에게 한 번에 발송

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

  -- Transition table을 사용하여 INSERT된 모든 참조자를 한 번에 처리
  -- Task별로 그룹화하여 중복 이메일 발송 방지
  
  FOR v_task_id IN (
    SELECT DISTINCT task_id
    FROM inserted_references
  )
  LOOP
    -- Task 정보 조회
    SELECT id, title, client_name, due_date, assigner_id, assignee_id
    INTO v_task
    FROM public.tasks
    WHERE id = v_task_id;
    
    IF NOT FOUND THEN
      CONTINUE;
    END IF;
    
    -- 지시자 정보 조회
    SELECT email, COALESCE(full_name, email) as name
    INTO v_assigner_profile
    FROM public.profiles
    WHERE id = v_task.assigner_id;
    
    -- 담당자 정보 조회
    SELECT email, COALESCE(full_name, email) as name
    INTO v_assignee_profile
    FROM public.profiles
    WHERE id = v_task.assignee_id;
    
    -- 해당 Task에 추가된 참조자 목록 생성
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
    
    -- 참조자가 없으면 스킵
    IF v_reference_emails IS NULL OR jsonb_array_length(v_reference_emails) = 0 THEN
      CONTINUE;
    END IF;
    
    -- Edge Function 요청 본문 생성
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
    
    -- Service Role Key
    -- 프로덕션 환경에서는 Supabase Secrets에 저장하고 참조하는 것이 좋음
    v_service_role_key := current_setting('app.supabase_service_role_key', true);
    
    -- Edge Function 호출 (비동기)
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
  
  RETURN NULL; -- FOR EACH STATEMENT 트리거는 NULL 반환
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.send_task_reference_email() IS 
'Trigger function that sends email notifications when users are added as references to a task. Uses FOR EACH STATEMENT to batch emails and prevent duplicates. Calls send-task-reference-email Edge Function.';

-- ----------------------------------------------------------------------------
-- 2. trigger_send_reference_email 트리거 생성
-- ----------------------------------------------------------------------------
-- AFTER INSERT ON task_references
-- FOR EACH STATEMENT: 같은 Task에 대한 여러 참조자 추가 시 1회만 발송

DROP TRIGGER IF EXISTS trigger_send_reference_email ON public.task_references;

CREATE TRIGGER trigger_send_reference_email
  AFTER INSERT ON public.task_references
  REFERENCING NEW TABLE AS inserted_references
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.send_task_reference_email();

COMMENT ON TRIGGER trigger_send_reference_email ON public.task_references IS 
'Automatically sends email to reference users when they are added to a task. Uses FOR EACH STATEMENT with transition table to batch emails and prevent duplicate sends.';

-- ----------------------------------------------------------------------------
-- 참고 사항
-- ----------------------------------------------------------------------------
-- 1. v_function_url: 로컬/프로덕션 환경에 맞게 수정 필요
--    - 로컬: http://127.0.0.1:54321/functions/v1/send-task-reference-email
--    - 프로덕션: https://[project-ref].supabase.co/functions/v1/send-task-reference-email
-- 
-- 2. v_service_role_key: 보안상 하드코딩보다 Supabase Secrets 사용 권장
--    - current_setting('app.supabase_service_role_key', true) 사용
--    - 또는 Edge Function에서 auth.uid() 권한 체크
-- 
-- 3. FOR EACH STATEMENT vs FOR EACH ROW:
--    - FOR EACH STATEMENT: Task 생성 시 참조자 3명 추가 → 이메일 1회 발송
--    - FOR EACH ROW: Task 생성 시 참조자 3명 추가 → 이메일 3회 발송 (비효율)
-- 
-- 4. transition table (REFERENCING NEW TABLE AS inserted_references):
--    - INSERT된 모든 row를 테이블처럼 참조 가능
--    - task_id별로 그룹화하여 배치 처리 가능
