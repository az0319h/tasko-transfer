-- ============================================================================
-- Phase 1: 통합 마이그레이션 파일 (Storage 정책 제외 버전)
-- ============================================================================
-- ⚠️ 주의: storage.objects에 대한 RLS 정책 생성 부분(라인 1190-1255)이 제외되었습니다.
-- Storage 정책은 Supabase Dashboard에서 수동으로 설정해야 합니다.
-- ============================================================================

-- ============================================================================
-- 1. tasks 테이블 컬럼 추가 (02_01_add_columns.sql)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. created_by 컬럼 추가
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tasks'
      AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.tasks
    ADD COLUMN created_by UUID;
    
    RAISE NOTICE 'tasks 테이블에 created_by 컬럼을 추가했습니다.';
  ELSE
    RAISE NOTICE 'tasks 테이블에 created_by 컬럼이 이미 존재합니다.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. client_name 컬럼 추가
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tasks'
      AND column_name = 'client_name'
  ) THEN
    ALTER TABLE public.tasks
    ADD COLUMN client_name TEXT;
    
    RAISE NOTICE 'tasks 테이블에 client_name 컬럼을 추가했습니다.';
  ELSE
    RAISE NOTICE 'tasks 테이블에 client_name 컬럼이 이미 존재합니다.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. send_email_to_client 컬럼 추가
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tasks'
      AND column_name = 'send_email_to_client'
  ) THEN
    ALTER TABLE public.tasks
    ADD COLUMN send_email_to_client BOOLEAN NOT NULL DEFAULT false;
    
    RAISE NOTICE 'tasks 테이블에 send_email_to_client 컬럼을 추가했습니다.';
  ELSE
    RAISE NOTICE 'tasks 테이블에 send_email_to_client 컬럼이 이미 존재합니다.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. created_by 외래키 제약조건 추가
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'tasks'
      AND constraint_name = 'tasks_created_by_fkey'
  ) THEN
    ALTER TABLE public.tasks
    ADD CONSTRAINT tasks_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES auth.users(id)
    ON DELETE RESTRICT;
    
    RAISE NOTICE 'tasks 테이블에 created_by 외래키 제약조건을 추가했습니다.';
  ELSE
    RAISE NOTICE 'tasks 테이블에 created_by 외래키 제약조건이 이미 존재합니다.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. 컬럼 코멘트 추가
-- ----------------------------------------------------------------------------

COMMENT ON COLUMN public.tasks.created_by IS '태스크를 생성한 사용자 ID (auth.users 참조)';
COMMENT ON COLUMN public.tasks.client_name IS '고객명 (프로젝트에서 마이그레이션됨)';
COMMENT ON COLUMN public.tasks.send_email_to_client IS '고객에게 이메일 발송 완료 여부 (승인 상태일 때만 사용)';

COMMIT;

-- ============================================================================
-- 2. 데이터 마이그레이션 (01_data_migration.sql)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 데이터 마이그레이션: projects → tasks
-- project_id가 존재하는 경우에만 데이터 마이그레이션 수행
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  project_id_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tasks'
      AND column_name = 'project_id'
  ) INTO project_id_exists;
  
  IF project_id_exists THEN
    UPDATE public.tasks t
    SET 
      created_by = p.created_by,
      client_name = p.client_name
    FROM public.projects p
    WHERE t.project_id = p.id
      AND (t.created_by IS NULL OR t.client_name IS NULL);
    
    RAISE NOTICE '데이터 마이그레이션을 완료했습니다.';
  ELSE
    RAISE NOTICE 'project_id 컬럼이 이미 제거되어 데이터 마이그레이션을 스킵합니다.';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- 3. tasks 테이블 RLS 정책 변경 (03_tasks_rls_policies.sql)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1단계: 새 정책 생성 (먼저 실행)
-- ----------------------------------------------------------------------------

-- SELECT 정책: 관리자는 모든 태스크, 멤버는 자신이 지시자/담당자인 태스크만
DROP POLICY IF EXISTS "tasks_select_admin_or_assigned" ON public.tasks;
CREATE POLICY "tasks_select_admin_or_assigned"
ON public.tasks
FOR SELECT
USING (
  is_admin(auth.uid())
  OR auth.uid() = assigner_id
  OR auth.uid() = assignee_id
);

-- INSERT 정책: 인증된 사용자만 생성 가능
DROP POLICY IF EXISTS "tasks_insert_authenticated" ON public.tasks;
CREATE POLICY "tasks_insert_authenticated"
ON public.tasks
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE 정책: 지시자 또는 담당자만 수정 가능
DROP POLICY IF EXISTS "tasks_update_assigner_or_assignee" ON public.tasks;
CREATE POLICY "tasks_update_assigner_or_assignee"
ON public.tasks
FOR UPDATE
USING (
  auth.uid() = assigner_id
  OR auth.uid() = assignee_id
)
WITH CHECK (
  auth.uid() = assigner_id
  OR auth.uid() = assignee_id
);

-- DELETE 정책: 관리자만 삭제 가능
DROP POLICY IF EXISTS "tasks_delete_admin_only" ON public.tasks;
CREATE POLICY "tasks_delete_admin_only"
ON public.tasks
FOR DELETE
USING (is_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- 2단계: 기존 정책 제거 (새 정책 생성 후 실행)
-- ----------------------------------------------------------------------------

-- project_id를 사용하는 기존 정책들 제거
DROP POLICY IF EXISTS "tasks_select_participant_or_admin" ON public.tasks;
DROP POLICY IF EXISTS "tasks_select_project_access" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert_participant_or_admin" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert_admin_or_participant" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_assigner_only" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_assignee_status" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_admin_or_assigner_assignee" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_assigner_or_assignee_only" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete_assigner_only" ON public.tasks;

-- ----------------------------------------------------------------------------
-- 3. 정책 코멘트 추가
-- ----------------------------------------------------------------------------

COMMENT ON POLICY "tasks_select_admin_or_assigned" ON public.tasks IS 
'태스크 조회 정책: 관리자는 모든 태스크 조회 가능, 멤버는 자신이 지시자/담당자인 태스크만 조회 가능';

COMMENT ON POLICY "tasks_insert_authenticated" ON public.tasks IS 
'태스크 생성 정책: 인증된 사용자만 태스크 생성 가능';

COMMENT ON POLICY "tasks_update_assigner_or_assignee" ON public.tasks IS 
'태스크 수정 정책: 지시자 또는 담당자만 태스크 수정 가능';

COMMENT ON POLICY "tasks_delete_admin_only" ON public.tasks IS 
'태스크 삭제 정책: 관리자만 태스크 삭제 가능';

COMMIT;

-- ============================================================================
-- 4. 다른 테이블 RLS 정책 변경 (03_02_other_tables_rls_policies.sql)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. messages 테이블 RLS 정책 수정
-- ----------------------------------------------------------------------------

-- SELECT 정책: 관리자 또는 태스크의 지시자/담당자만 메시지 조회 가능
DROP POLICY IF EXISTS "messages_select_participant_or_admin" ON public.messages;
CREATE POLICY "messages_select_participant_or_admin"
ON public.messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = messages.task_id
    AND (
      is_admin(auth.uid())
      OR auth.uid() = tasks.assigner_id
      OR auth.uid() = tasks.assignee_id
    )
  )
);

COMMENT ON POLICY "messages_select_participant_or_admin" ON public.messages IS 
'메시지 조회 정책: 관리자 또는 태스크의 지시자/담당자만 메시지 조회 가능';

-- ----------------------------------------------------------------------------
-- 2. task_chat_logs 테이블 RLS 정책 수정
-- ----------------------------------------------------------------------------

-- SELECT 정책: 관리자 또는 태스크의 지시자/담당자만 조회 가능
DROP POLICY IF EXISTS "task_chat_logs_select_task_participants" ON public.task_chat_logs;
CREATE POLICY "task_chat_logs_select_task_participants"
ON public.task_chat_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = task_chat_logs.task_id
    AND (
      is_admin(auth.uid())
      OR auth.uid() = tasks.assigner_id
      OR auth.uid() = tasks.assignee_id
    )
  )
);

-- INSERT 정책: 상태 변경 권한자만 가능 (assigner/assignee)
DROP POLICY IF EXISTS "task_chat_logs_insert_status_changer" ON public.task_chat_logs;
CREATE POLICY "task_chat_logs_insert_status_changer"
ON public.task_chat_logs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = task_chat_logs.task_id
    AND (
      tasks.assigner_id = auth.uid()
      OR tasks.assignee_id = auth.uid()
    )
  )
);

COMMENT ON POLICY "task_chat_logs_select_task_participants" ON public.task_chat_logs IS 
'채팅 로그 조회 정책: 관리자 또는 태스크의 지시자/담당자만 조회 가능';

COMMENT ON POLICY "task_chat_logs_insert_status_changer" ON public.task_chat_logs IS 
'채팅 로그 생성 정책: 태스크의 지시자 또는 담당자만 생성 가능';

-- ----------------------------------------------------------------------------
-- 3. task_chat_log_items 테이블 RLS 정책 수정
-- ----------------------------------------------------------------------------

-- SELECT 정책: 관리자 또는 태스크의 지시자/담당자만 조회 가능
DROP POLICY IF EXISTS "task_chat_log_items_select_task_participants" ON public.task_chat_log_items;
CREATE POLICY "task_chat_log_items_select_task_participants"
ON public.task_chat_log_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.task_chat_logs
    JOIN public.tasks ON tasks.id = task_chat_logs.task_id
    WHERE task_chat_log_items.log_id = task_chat_logs.id
    AND (
      is_admin(auth.uid())
      OR auth.uid() = tasks.assigner_id
      OR auth.uid() = tasks.assignee_id
    )
  )
);

-- INSERT 정책: 상태 변경 권한자만 가능 (assigner/assignee)
DROP POLICY IF EXISTS "task_chat_log_items_insert_status_changer" ON public.task_chat_log_items;
CREATE POLICY "task_chat_log_items_insert_status_changer"
ON public.task_chat_log_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.task_chat_logs
    JOIN public.tasks ON tasks.id = task_chat_logs.task_id
    WHERE task_chat_log_items.log_id = task_chat_logs.id
    AND (
      tasks.assigner_id = auth.uid()
      OR tasks.assignee_id = auth.uid()
    )
  )
);

COMMENT ON POLICY "task_chat_log_items_select_task_participants" ON public.task_chat_log_items IS 
'채팅 로그 아이템 조회 정책: 관리자 또는 태스크의 지시자/담당자만 조회 가능';

COMMENT ON POLICY "task_chat_log_items_insert_status_changer" ON public.task_chat_log_items IS 
'채팅 로그 아이템 생성 정책: 태스크의 지시자 또는 담당자만 생성 가능';

COMMIT;

-- ============================================================================
-- 5. project_id 제거 (02_02_remove_project_id.sql)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. project_id 외래키 제약조건 제거
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'tasks'
      AND constraint_name = 'tasks_project_id_fkey'
  ) THEN
    ALTER TABLE public.tasks
    DROP CONSTRAINT tasks_project_id_fkey;
    
    RAISE NOTICE 'tasks 테이블에서 project_id 외래키 제약조건을 제거했습니다.';
  ELSE
    RAISE NOTICE 'tasks 테이블에 project_id 외래키 제약조건이 존재하지 않습니다.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. project_id 관련 인덱스 제거
-- ----------------------------------------------------------------------------

-- idx_tasks_project_id 인덱스 제거
DROP INDEX IF EXISTS public.idx_tasks_project_id;

-- idx_tasks_project_status 복합 인덱스 제거
DROP INDEX IF EXISTS public.idx_tasks_project_status;

-- ----------------------------------------------------------------------------
-- 3. project_id 컬럼 제거
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tasks'
      AND column_name = 'project_id'
  ) THEN
    ALTER TABLE public.tasks
    DROP COLUMN project_id;
    
    RAISE NOTICE 'tasks 테이블에서 project_id 컬럼을 제거했습니다.';
  ELSE
    RAISE NOTICE 'tasks 테이블에 project_id 컬럼이 존재하지 않습니다.';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- 6. 함수 및 트리거 수정 (04_functions_triggers.sql)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. 프로젝트 관련 함수 제거
-- ----------------------------------------------------------------------------

-- has_task_in_project 함수 제거 (project_id 의존성)
DROP FUNCTION IF EXISTS public.has_task_in_project(UUID, UUID);

-- 프로젝트 관련 함수들 제거 (존재하는 경우에만)
DROP FUNCTION IF EXISTS public.create_project_with_participants(text, text, timestamp with time zone, uuid[]);
DROP FUNCTION IF EXISTS public.get_project_summaries();
DROP FUNCTION IF EXISTS public.has_project_access(uuid, uuid);
-- is_project_participant는 프로젝트 정책 제거 후 제거됨 (8번 섹션 참조)

-- ----------------------------------------------------------------------------
-- 2-1. send_task_created_email 함수 수정
-- ----------------------------------------------------------------------------
-- project_id, project_title 제거하고 client_name 사용

CREATE OR REPLACE FUNCTION public.send_task_created_email()
RETURNS TRIGGER AS $$
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

  -- Build request body for Edge Function (project_id, project_title 제거, client_name 추가)
  -- taskDescription 제거 (tasks 테이블에 description 컬럼이 없음)
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
    RAISE EXCEPTION 'app.supabase_function_base_url가 설정되지 않았습니다. ALTER DATABASE postgres SET app.supabase_function_base_url = ''https://your-project.supabase.co/functions/v1''; 로 설정하세요.';
  END IF;

  -- Service Role Key: DB 설정에서 로드 (ALTER DATABASE postgres SET app.supabase_service_role_key = 'your-key';)
  service_role_key := NULLIF(TRIM(current_setting('app.supabase_service_role_key', true)), '');
  IF service_role_key IS NULL OR service_role_key = '' THEN
    RAISE EXCEPTION 'app.supabase_service_role_key가 설정되지 않았습니다. ALTER DATABASE postgres SET app.supabase_service_role_key = ''your-key''; 로 설정하세요.';
  END IF;

  RAISE NOTICE '[EMAIL_TRIGGER] Calling Edge Function: %', function_url;
  RAISE NOTICE '[EMAIL_TRIGGER] Request body: %', request_body;

  -- Call Edge Function via HTTP (non-blocking)
  -- 올바른 시그니처: net.http_post(url text, body jsonb, params jsonb, headers jsonb)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.send_task_created_email() IS 
'Trigger function that sends email notifications when task is created via Edge Function. Uses hardcoded URL and Service Role Key. ⚠️ 주의: 다른 데이터베이스 환경에 적용할 때는 함수 내부의 하드코딩된 값을 변경해야 합니다. Includes enhanced logging for debugging. Updated to use client_name instead of project_id/project_title.';

-- ----------------------------------------------------------------------------
-- 2. send_task_status_change_email 함수 수정
-- ----------------------------------------------------------------------------
-- project_id, project_title 제거하고 client_name 사용

CREATE OR REPLACE FUNCTION public.send_task_status_change_email()
RETURNS TRIGGER AS $$
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

  -- Build request body for Edge Function (project_id, project_title 제거, client_name 추가)
  -- taskDescription 제거 (tasks 테이블에 description 컬럼이 없음)
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
    RAISE EXCEPTION 'app.supabase_function_base_url가 설정되지 않았습니다. ALTER DATABASE postgres SET app.supabase_function_base_url = ''https://your-project.supabase.co/functions/v1''; 로 설정하세요.';
  END IF;

  -- Service Role Key: DB 설정에서 로드 (ALTER DATABASE postgres SET app.supabase_service_role_key = 'your-key';)
  service_role_key := NULLIF(TRIM(current_setting('app.supabase_service_role_key', true)), '');
  IF service_role_key IS NULL OR service_role_key = '' THEN
    RAISE EXCEPTION 'app.supabase_service_role_key가 설정되지 않았습니다. ALTER DATABASE postgres SET app.supabase_service_role_key = ''your-key''; 로 설정하세요.';
  END IF;

  RAISE NOTICE '[EMAIL_TRIGGER] Calling Edge Function: %', function_url;
  RAISE NOTICE '[EMAIL_TRIGGER] Request body: %', request_body;

  -- Call Edge Function via HTTP (non-blocking)
  -- 올바른 시그니처: net.http_post(url text, body jsonb, params jsonb, headers jsonb)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update comments
COMMENT ON FUNCTION public.send_task_status_change_email() IS 
'Trigger function that sends email notifications when task status changes via Edge Function. Uses hardcoded URL and Service Role Key. ⚠️ 주의: 다른 데이터베이스 환경에 적용할 때는 함수 내부의 하드코딩된 값을 변경해야 합니다. Includes enhanced logging for debugging. Updated to use client_name instead of project_id/project_title.';

COMMIT;

-- ============================================================================
-- 7. profiles RLS 정책 및 can_access_profile 함수 수정 (04_02_fix_profiles_rls_and_can_access_profile.sql)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. can_access_profile 함수 수정
-- ----------------------------------------------------------------------------
-- 프로젝트 구조 제거에 맞게 수정
-- Task를 통해 연결된 경우만 프로필 조회 가능하도록 변경

CREATE OR REPLACE FUNCTION public.can_access_profile(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- 프로젝트 구조가 제거되었으므로 Task 기반으로만 접근 가능 여부 확인
  -- 현재 사용자가 접근할 수 있는 Task에서 target_user_id가 assigner 또는 assignee로 참여한 경우
  RETURN EXISTS (
    SELECT 1 FROM public.tasks
    WHERE (tasks.assigner_id = target_user_id OR tasks.assignee_id = target_user_id)
    AND (
      -- 현재 사용자가 관리자이거나
      is_admin(auth.uid())
      -- 현재 사용자가 해당 Task의 지시자 또는 담당자인 경우
      OR auth.uid() = tasks.assigner_id
      OR auth.uid() = tasks.assignee_id
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.can_access_profile(UUID) IS 
'프로필 접근 권한 확인 함수: Task를 통해 연결된 경우 프로필 조회 가능. 프로젝트 구조 제거에 맞게 수정됨. 현재 사용자가 접근할 수 있는 Task에서 target_user_id가 assigner 또는 assignee로 참여한 경우 true 반환.';

-- ----------------------------------------------------------------------------
-- 2. profiles RLS 정책 수정
-- ----------------------------------------------------------------------------
-- profiles_select_same_project 정책 제거 (프로젝트 구조 제거로 더 이상 필요 없음)
-- 기존 정책들(Users can view own profile, Admins can view all profiles)은 유지

-- 프로젝트 기반 정책 제거
DROP POLICY IF EXISTS "profiles_select_same_project" ON public.profiles;

COMMIT;

-- ============================================================================
-- 8. 인덱스 및 외래키 정리 (05_indexes_foreign_keys.sql)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. created_by 인덱스 추가
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_tasks_created_by 
ON public.tasks(created_by);

COMMENT ON INDEX idx_tasks_created_by IS 
'태스크 생성자 인덱스: created_by 컬럼 조회 성능 최적화';

-- ----------------------------------------------------------------------------
-- 2. client_name 인덱스 추가
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_tasks_client_name 
ON public.tasks(client_name);

COMMENT ON INDEX idx_tasks_client_name IS 
'고객명 인덱스: client_name 컬럼 검색 성능 최적화';

COMMIT;

-- ============================================================================
-- 9. 공지사항 테이블 생성 및 RLS 정책 (06_announcements_tables.sql)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. announcements 테이블 생성
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'announcements'
  ) THEN
    CREATE TABLE public.announcements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      image_url TEXT,
      created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    
    RAISE NOTICE 'announcements 테이블을 생성했습니다.';
  ELSE
    RAISE NOTICE 'announcements 테이블이 이미 존재합니다.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. announcement_dismissals 테이블 생성
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'announcement_dismissals'
  ) THEN
    CREATE TABLE public.announcement_dismissals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      dismissed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(announcement_id, user_id)
    );
    
    RAISE NOTICE 'announcement_dismissals 테이블을 생성했습니다.';
  ELSE
    RAISE NOTICE 'announcement_dismissals 테이블이 이미 존재합니다.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. announcement_attachments 테이블 생성
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'announcement_attachments'
  ) THEN
    CREATE TABLE public.announcement_attachments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      file_url TEXT NOT NULL,
      file_size BIGINT,
      file_type TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    
    RAISE NOTICE 'announcement_attachments 테이블을 생성했습니다.';
  ELSE
    RAISE NOTICE 'announcement_attachments 테이블이 이미 존재합니다.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. 인덱스 생성
-- ----------------------------------------------------------------------------

-- announcements 테이블 인덱스
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'announcements'
      AND indexname = 'idx_announcements_is_active'
  ) THEN
    CREATE INDEX idx_announcements_is_active 
    ON public.announcements(is_active) 
    WHERE is_active = true;
    
    RAISE NOTICE 'idx_announcements_is_active 인덱스를 생성했습니다.';
  ELSE
    RAISE NOTICE 'idx_announcements_is_active 인덱스가 이미 존재합니다.';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'announcements'
      AND indexname = 'idx_announcements_created_at'
  ) THEN
    CREATE INDEX idx_announcements_created_at 
    ON public.announcements(created_at DESC);
    
    RAISE NOTICE 'idx_announcements_created_at 인덱스를 생성했습니다.';
  ELSE
    RAISE NOTICE 'idx_announcements_created_at 인덱스가 이미 존재합니다.';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'announcements'
      AND indexname = 'idx_announcements_expires_at'
  ) THEN
    CREATE INDEX idx_announcements_expires_at 
    ON public.announcements(expires_at) 
    WHERE expires_at IS NOT NULL;
    
    RAISE NOTICE 'idx_announcements_expires_at 인덱스를 생성했습니다.';
  ELSE
    RAISE NOTICE 'idx_announcements_expires_at 인덱스가 이미 존재합니다.';
  END IF;
END $$;

-- announcement_dismissals 테이블 인덱스
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'announcement_dismissals'
      AND indexname = 'idx_announcement_dismissals_announcement_user'
  ) THEN
    CREATE INDEX idx_announcement_dismissals_announcement_user 
    ON public.announcement_dismissals(announcement_id, user_id);
    
    RAISE NOTICE 'idx_announcement_dismissals_announcement_user 인덱스를 생성했습니다.';
  ELSE
    RAISE NOTICE 'idx_announcement_dismissals_announcement_user 인덱스가 이미 존재합니다.';
  END IF;
END $$;

-- announcement_attachments 테이블 인덱스
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'announcement_attachments'
      AND indexname = 'idx_announcement_attachments_announcement_id'
  ) THEN
    CREATE INDEX idx_announcement_attachments_announcement_id 
    ON public.announcement_attachments(announcement_id);
    
    RAISE NOTICE 'idx_announcement_attachments_announcement_id 인덱스를 생성했습니다.';
  ELSE
    RAISE NOTICE 'idx_announcement_attachments_announcement_id 인덱스가 이미 존재합니다.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. RLS 활성화
-- ----------------------------------------------------------------------------

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_dismissals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_attachments ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 6. announcements 테이블 RLS 정책
-- ----------------------------------------------------------------------------

-- SELECT 정책: 활성 공지사항은 모든 인증 사용자 조회 가능, 관리자는 모든 공지사항 조회 가능
DROP POLICY IF EXISTS "announcements_select_active" ON public.announcements;
CREATE POLICY "announcements_select_active"
ON public.announcements
FOR SELECT
USING (
  (is_active = true AND (expires_at IS NULL OR expires_at > NOW()))
  OR is_admin(auth.uid())
);

-- INSERT 정책: 관리자만 생성 가능
DROP POLICY IF EXISTS "announcements_insert_admin" ON public.announcements;
CREATE POLICY "announcements_insert_admin"
ON public.announcements
FOR INSERT
WITH CHECK (is_admin(auth.uid()));

-- UPDATE 정책: 관리자만 수정 가능
DROP POLICY IF EXISTS "announcements_update_admin" ON public.announcements;
CREATE POLICY "announcements_update_admin"
ON public.announcements
FOR UPDATE
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- DELETE 정책: 관리자만 삭제 가능
DROP POLICY IF EXISTS "announcements_delete_admin" ON public.announcements;
CREATE POLICY "announcements_delete_admin"
ON public.announcements
FOR DELETE
USING (is_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- 7. announcement_dismissals 테이블 RLS 정책
-- ----------------------------------------------------------------------------

-- SELECT 정책: 자신의 레코드만 조회 가능
DROP POLICY IF EXISTS "announcement_dismissals_select_own" ON public.announcement_dismissals;
CREATE POLICY "announcement_dismissals_select_own"
ON public.announcement_dismissals
FOR SELECT
USING (auth.uid() = user_id);

-- INSERT 정책: 자신의 레코드만 생성 가능
DROP POLICY IF EXISTS "announcement_dismissals_insert_own" ON public.announcement_dismissals;
CREATE POLICY "announcement_dismissals_insert_own"
ON public.announcement_dismissals
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 8. announcement_attachments 테이블 RLS 정책
-- ----------------------------------------------------------------------------

-- SELECT 정책: 인증된 사용자는 모두 조회 가능
DROP POLICY IF EXISTS "announcement_attachments_select_all" ON public.announcement_attachments;
CREATE POLICY "announcement_attachments_select_all"
ON public.announcement_attachments
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- INSERT 정책: 관리자만 생성 가능
DROP POLICY IF EXISTS "announcement_attachments_insert_admin" ON public.announcement_attachments;
CREATE POLICY "announcement_attachments_insert_admin"
ON public.announcement_attachments
FOR INSERT
WITH CHECK (is_admin(auth.uid()));

-- UPDATE 정책: 관리자만 수정 가능
DROP POLICY IF EXISTS "announcement_attachments_update_admin" ON public.announcement_attachments;
CREATE POLICY "announcement_attachments_update_admin"
ON public.announcement_attachments
FOR UPDATE
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- DELETE 정책: 관리자만 삭제 가능
DROP POLICY IF EXISTS "announcement_attachments_delete_admin" ON public.announcement_attachments;
CREATE POLICY "announcement_attachments_delete_admin"
ON public.announcement_attachments
FOR DELETE
USING (is_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- 9. updated_at 자동 업데이트 트리거
-- ----------------------------------------------------------------------------

-- announcements 테이블의 updated_at 트리거
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_announcements_updated_at'
  ) THEN
    CREATE TRIGGER update_announcements_updated_at
    BEFORE UPDATE ON public.announcements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
    
    RAISE NOTICE 'announcements 테이블의 updated_at 트리거를 생성했습니다.';
  ELSE
    RAISE NOTICE 'announcements 테이블의 updated_at 트리거가 이미 존재합니다.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 10. 테이블 및 컬럼 코멘트 추가
-- ----------------------------------------------------------------------------

COMMENT ON TABLE public.announcements IS '공지사항 테이블: 관리자가 작성한 공지사항 정보';
COMMENT ON COLUMN public.announcements.title IS '공지사항 제목';
COMMENT ON COLUMN public.announcements.content IS '공지사항 내용';
COMMENT ON COLUMN public.announcements.image_url IS '공지사항 최상단 이미지 URL (선택사항)';
COMMENT ON COLUMN public.announcements.created_by IS '공지사항 작성자 ID (auth.users 참조)';
COMMENT ON COLUMN public.announcements.is_active IS '공지사항 활성 여부 (true: 활성, false: 비활성)';
COMMENT ON COLUMN public.announcements.expires_at IS '공지사항 게시 종료 날짜 (NULL이면 무기한)';

COMMENT ON TABLE public.announcement_dismissals IS '공지사항 "다시 보지 않음" 기록 테이블: 사용자가 특정 공지사항을 다시 보지 않기로 선택한 기록';
COMMENT ON COLUMN public.announcement_dismissals.announcement_id IS '공지사항 ID';
COMMENT ON COLUMN public.announcement_dismissals.user_id IS '사용자 ID (auth.users 참조)';
COMMENT ON COLUMN public.announcement_dismissals.dismissed_at IS '다시 보지 않기로 선택한 시간';

COMMENT ON TABLE public.announcement_attachments IS '공지사항 파일 첨부 테이블: 공지사항에 첨부된 파일 정보';
COMMENT ON COLUMN public.announcement_attachments.announcement_id IS '공지사항 ID';
COMMENT ON COLUMN public.announcement_attachments.file_name IS '파일명';
COMMENT ON COLUMN public.announcement_attachments.file_url IS '파일 URL (Storage 버킷 경로)';
COMMENT ON COLUMN public.announcement_attachments.file_size IS '파일 크기 (bytes)';
COMMENT ON COLUMN public.announcement_attachments.file_type IS '파일 타입 (MIME type)';

-- ----------------------------------------------------------------------------
-- 11. RLS 정책 코멘트 추가
-- ----------------------------------------------------------------------------

COMMENT ON POLICY "announcements_select_active" ON public.announcements IS 
'공지사항 조회 정책: 활성 공지사항은 모든 인증 사용자 조회 가능, 관리자는 모든 공지사항 조회 가능';

COMMENT ON POLICY "announcements_insert_admin" ON public.announcements IS 
'공지사항 생성 정책: 관리자만 공지사항 생성 가능';

COMMENT ON POLICY "announcements_update_admin" ON public.announcements IS 
'공지사항 수정 정책: 관리자만 공지사항 수정 가능';

COMMENT ON POLICY "announcements_delete_admin" ON public.announcements IS 
'공지사항 삭제 정책: 관리자만 공지사항 삭제 가능';

COMMENT ON POLICY "announcement_dismissals_select_own" ON public.announcement_dismissals IS 
'공지사항 "다시 보지 않음" 조회 정책: 자신의 레코드만 조회 가능';

COMMENT ON POLICY "announcement_dismissals_insert_own" ON public.announcement_dismissals IS 
'공지사항 "다시 보지 않음" 생성 정책: 자신의 레코드만 생성 가능';

COMMENT ON POLICY "announcement_attachments_select_all" ON public.announcement_attachments IS 
'공지사항 첨부파일 조회 정책: 인증된 사용자는 모두 조회 가능';

COMMENT ON POLICY "announcement_attachments_insert_admin" ON public.announcement_attachments IS 
'공지사항 첨부파일 생성 정책: 관리자만 생성 가능';

COMMENT ON POLICY "announcement_attachments_update_admin" ON public.announcement_attachments IS 
'공지사항 첨부파일 수정 정책: 관리자만 수정 가능';

COMMENT ON POLICY "announcement_attachments_delete_admin" ON public.announcement_attachments IS 
'공지사항 첨부파일 삭제 정책: 관리자만 삭제 가능';

COMMIT;

-- ============================================================================
-- 10. 공지사항 스토리지 버킷 생성 (Storage 정책 제외)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. announcements 스토리지 버킷 생성
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'announcements'
  ) THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'announcements',
      'announcements',
      true, -- Public: true (모든 인증 사용자가 읽기 가능)
      52428800, -- 50MB 파일 크기 제한
      ARRAY[
        'image/*', -- 이미지 파일
        'application/pdf', -- PDF 파일
        'application/msword', -- .doc
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', -- .docx
        'application/vnd.ms-excel', -- .xls
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', -- .xlsx
        'application/vnd.ms-powerpoint', -- .ppt
        'application/vnd.openxmlformats-officedocument.presentationml.presentation', -- .pptx
        'text/plain', -- .txt
        'text/csv', -- .csv
        'application/zip', -- .zip
        'application/x-rar-compressed', -- .rar
        'application/vnd.rar', -- .rar
        'application/x-7z-compressed', -- .7z
        'application/octet-stream' -- 기타 파일
      ]
    );
    
    RAISE NOTICE 'announcements 스토리지 버킷을 생성했습니다.';
  ELSE
    RAISE NOTICE 'announcements 스토리지 버킷이 이미 존재합니다.';
  END IF;
END $$;

-- ⚠️ 주의: storage.objects에 대한 RLS 정책은 Supabase Dashboard에서 수동으로 설정해야 합니다.
-- Storage > Policies > announcements 버킷에 다음 정책을 추가하세요:
-- 1. SELECT: 모든 인증 사용자 (bucket_id = 'announcements')
-- 2. INSERT/UPDATE/DELETE: 관리자만 (bucket_id = 'announcements' AND is_admin(auth.uid()))

COMMIT;

-- ============================================================================
-- 11. 프로젝트 관련 정리 (정책 및 함수 제거)
-- ============================================================================

BEGIN;

-- 프로젝트 관련 정책 제거 (테이블이 존재하는 경우에만)
DO $$
BEGIN
  -- projects 테이블이 존재하는 경우에만 정책 제거
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'projects'
  ) THEN
    DROP POLICY IF EXISTS "projects_select_admin_or_participant" ON public.projects;
    DROP POLICY IF EXISTS "projects_insert_admin_only" ON public.projects;
    DROP POLICY IF EXISTS "projects_update_admin_only" ON public.projects;
    DROP POLICY IF EXISTS "projects_delete_admin_only" ON public.projects;
    RAISE NOTICE 'projects 테이블의 정책을 제거했습니다.';
  ELSE
    RAISE NOTICE 'projects 테이블이 존재하지 않아 정책 제거를 스킵합니다.';
  END IF;

  -- project_participants 테이블이 존재하는 경우에만 정책 제거
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'project_participants'
  ) THEN
    DROP POLICY IF EXISTS "project_participants_select_participant_or_admin" ON public.project_participants;
    DROP POLICY IF EXISTS "project_participants_insert_admin_only" ON public.project_participants;
    DROP POLICY IF EXISTS "project_participants_delete_admin_only" ON public.project_participants;
    RAISE NOTICE 'project_participants 테이블의 정책을 제거했습니다.';
  ELSE
    RAISE NOTICE 'project_participants 테이블이 존재하지 않아 정책 제거를 스킵합니다.';
  END IF;
END $$;

-- is_project_participant 함수 제거 (정책 제거 후 가능)
DROP FUNCTION IF EXISTS public.is_project_participant(uuid, uuid);

COMMIT;

-- ============================================================================
-- 12. 프로젝트 테이블 제거 (최종 단계)
-- ============================================================================

BEGIN;

-- project_participants 테이블 제거 (CASCADE로 관련 인덱스도 자동 제거)
DROP TABLE IF EXISTS public.project_participants CASCADE;

-- projects 테이블 제거 (CASCADE로 관련 인덱스, 트리거도 자동 제거)
DROP TABLE IF EXISTS public.projects CASCADE;

COMMIT;

-- ============================================================================
-- 13. 태스크 생성 시 활성 프로필 조회 허용 (20260123000001_allow_active_profiles_for_task_creation.sql)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- profiles 테이블 RLS 정책 추가
-- ----------------------------------------------------------------------------
-- 인증된 사용자는 활성 상태인 프로필을 조회할 수 있도록 허용
-- 이렇게 하면 태스크 생성 시 담당자 선택이 가능합니다

CREATE POLICY "profiles_select_active_for_authenticated"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  is_active = true
  AND profile_completed = true
);

COMMENT ON POLICY "profiles_select_active_for_authenticated" ON public.profiles IS 
'인증된 사용자는 활성 상태이고 프로필이 완료된 사용자의 프로필을 조회할 수 있습니다. 태스크 생성 시 담당자 선택을 위해 필요합니다.';

COMMIT;
