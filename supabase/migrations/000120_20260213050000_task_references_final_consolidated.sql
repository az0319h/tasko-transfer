-- ============================================================================
-- [통합] Task 참조자(Reference) 기능 최종 마이그레이션
-- ============================================================================
-- multi-chat 폴더 내 14개 마이그레이션을 단일 파일로 통합
-- 적용 대상: task_references 테이블, RLS 정책, 읽음 함수, 이메일 트리거, is_public 제거
--
-- 사전 요구사항: tasks, messages, profiles, task_lists, task_list_items,
--               task_chat_logs, task_chat_log_items, notifications 테이블 및
--               is_admin() 함수, pg_net 확장(net.http_post) 존재
--
-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠️  하드코딩 필수 수정 사항 (배포 전 반드시 확인)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 1. SUPABASE 프로젝트 URL (2곳)
--    - send_task_reference_email() 함수 내
--    - send_task_reference_email_on_status_change() 함수 내
--    현재값: https://[YOUR_PROJECT_REF].supabase.co/functions/v1/send-task-reference-email
--    수정:   https://[YOUR_PROJECT_REF].supabase.co/functions/v1/send-task-reference-email
--    로컬:   http://127.0.0.1:54321/functions/v1/send-task-reference-email
--
-- 2. SERVICE ROLE KEY (2곳) ★ 보안 중요 ★
--    - send_task_reference_email() 함수 내
--    - send_task_reference_email_on_status_change() 함수 내
--    현재: JWT 하드코딩 (Supabase Dashboard > Settings > API > service_role)
--    권장: Supabase Secrets 또는 환경 변수 사용 (배포 환경)
--
-- ═══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- Phase 1: task_references 테이블 생성
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.task_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(task_id, user_id)
);

COMMENT ON TABLE public.task_references IS 
'Task 참조자 테이블: Task당 n명의 참조자 지원. 참조자는 채팅·읽음·이메일만 가능, 일정·알림·상태 변경 불가.';

COMMENT ON COLUMN public.task_references.task_id IS '참조 대상 Task ID';
COMMENT ON COLUMN public.task_references.user_id IS '참조자 User ID';
COMMENT ON COLUMN public.task_references.created_at IS '참조자 추가 시간';

CREATE INDEX IF NOT EXISTS idx_task_references_task_id ON public.task_references(task_id);
CREATE INDEX IF NOT EXISTS idx_task_references_user_id ON public.task_references(user_id);

ALTER TABLE public.task_references ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- is_task_reference 함수 (RLS 무한 재귀 방지 - 정책보다 먼저 생성)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_task_reference(p_task_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.task_references
    WHERE task_id = p_task_id AND user_id = p_user_id
  );
$$;

COMMENT ON FUNCTION public.is_task_reference(UUID, UUID) IS
'참조자 여부 확인. SECURITY DEFINER로 RLS 우회하여 tasks 정책 내 task_references 조회 시 무한 재귀 방지.';

-- task_references RLS 정책 (참조자도 다른 참조자 조회 가능)
DROP POLICY IF EXISTS "task_references_select_task_participants_or_admin" ON public.task_references;
CREATE POLICY "task_references_select_task_participants_or_admin"
ON public.task_references FOR SELECT
USING (
  is_admin((SELECT auth.uid()))
  OR user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = task_references.task_id
    AND (tasks.assigner_id = (SELECT auth.uid()) OR tasks.assignee_id = (SELECT auth.uid()))
  )
  OR is_task_reference(task_references.task_id, (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "task_references_insert_assigner_or_admin" ON public.task_references;
CREATE POLICY "task_references_insert_assigner_or_admin"
ON public.task_references FOR INSERT
WITH CHECK (
  is_admin((SELECT auth.uid()))
  OR EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = task_references.task_id AND tasks.assigner_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "task_references_delete_assigner_or_admin" ON public.task_references;
CREATE POLICY "task_references_delete_assigner_or_admin"
ON public.task_references FOR DELETE
USING (
  is_admin((SELECT auth.uid()))
  OR EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = task_references.task_id AND tasks.assigner_id = (SELECT auth.uid())
  )
);

-- ============================================================================
-- Phase 1: can_access_profile 함수 수정
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_access_profile(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.tasks
    WHERE (
      tasks.assigner_id = target_user_id OR tasks.assignee_id = target_user_id
      OR EXISTS (
        SELECT 1 FROM public.task_references
        WHERE task_references.task_id = tasks.id AND task_references.user_id = target_user_id
      )
    )
    AND (
      is_admin(auth.uid())
      OR auth.uid() = tasks.assigner_id OR auth.uid() = tasks.assignee_id
      OR EXISTS (
        SELECT 1 FROM public.task_references
        WHERE task_references.task_id = tasks.id AND task_references.user_id = auth.uid()
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Phase 2: messages RLS 정책
-- ============================================================================

DROP POLICY IF EXISTS "messages_select_assigner_assignee_or_admin" ON public.messages;
CREATE POLICY "messages_select_assigner_assignee_reference_or_admin"
ON public.messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = messages.task_id
    AND (
      is_admin((SELECT auth.uid()))
      OR tasks.assigner_id = (SELECT auth.uid())
      OR tasks.assignee_id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.task_references
        WHERE task_references.task_id = tasks.id AND task_references.user_id = (SELECT auth.uid())
      )
    )
  )
);

DROP POLICY IF EXISTS "messages_insert_assigner_or_assignee_only" ON public.messages;
CREATE POLICY "messages_insert_assigner_assignee_or_reference"
ON public.messages FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = messages.task_id)
  AND EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = messages.task_id
    AND (
      tasks.assigner_id = auth.uid() OR tasks.assignee_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.task_references
        WHERE task_references.task_id = tasks.id AND task_references.user_id = auth.uid()
      )
    )
  )
  AND auth.uid() = user_id
);

-- ============================================================================
-- Phase 2: tasks RLS 정책 (is_public 제거 최종 버전)
-- ============================================================================

DROP POLICY IF EXISTS "tasks_select_assigner_assignee_reference_or_admin" ON public.tasks;
CREATE POLICY "tasks_select_assigner_assignee_reference_or_admin"
ON public.tasks FOR SELECT
USING (
  (is_self_task = true AND auth.uid() = assigner_id)
  OR
  (is_self_task = false AND (
    is_admin((SELECT auth.uid()))
    OR (SELECT auth.uid()) = assigner_id
    OR (SELECT auth.uid()) = assignee_id
    OR is_task_reference(id, (SELECT auth.uid()))
  ))
);

DROP POLICY IF EXISTS "tasks_select_own_notification_tasks" ON public.tasks;
CREATE POLICY "tasks_select_own_notification_tasks"
ON public.tasks FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.notifications
    WHERE notifications.task_id = tasks.id AND notifications.user_id = auth.uid()
  )
);

COMMENT ON POLICY "tasks_select_assigner_assignee_reference_or_admin" ON public.tasks IS
'Task 조회 정책: 자기 할당은 본인만, 일반 Task는 admin/지시자/담당자/참조자만. (is_public 제거됨)';

-- ============================================================================
-- Phase 2: task_list_items RLS 정책 (is_public 제거 최종 버전)
-- ============================================================================

DROP POLICY IF EXISTS "task_list_items_insert_own_list_with_permission" ON public.task_list_items;
CREATE POLICY "task_list_items_insert_own_list_with_permission" ON public.task_list_items
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.task_lists
    WHERE task_lists.id = task_list_items.task_list_id AND task_lists.user_id = auth.uid()
  )
  AND (
    is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_list_items.task_id
      AND (tasks.assigner_id = auth.uid() OR tasks.assignee_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.task_references tr ON tr.task_id = t.id
      WHERE t.id = task_list_items.task_id AND tr.user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "task_list_items_insert_task_access_with_references" ON public.task_list_items;
DROP POLICY IF EXISTS "task_list_items_insert_task_access" ON public.task_list_items;
CREATE POLICY "task_list_items_insert_task_access_with_references"
ON public.task_list_items FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = task_list_items.task_id
    AND (
      auth.uid() = tasks.assigner_id OR auth.uid() = tasks.assignee_id
      OR EXISTS (
        SELECT 1 FROM public.task_references
        WHERE task_references.task_id = tasks.id AND task_references.user_id = auth.uid()
      )
    )
  )
);

-- ============================================================================
-- Phase 2: task_chat_logs, task_chat_log_items RLS 정책 (is_public 제거 최종)
-- ============================================================================

DROP POLICY IF EXISTS "task_chat_logs_select_task_access_with_references" ON public.task_chat_logs;
DROP POLICY IF EXISTS "task_chat_logs_select_task_access" ON public.task_chat_logs;
CREATE POLICY "task_chat_logs_select_task_access_with_references"
ON public.task_chat_logs FOR SELECT
USING (
  is_admin((SELECT auth.uid()))
  OR EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = task_chat_logs.task_id
    AND (
      auth.uid() = tasks.assigner_id OR auth.uid() = tasks.assignee_id
      OR EXISTS (
        SELECT 1 FROM public.task_references
        WHERE task_references.task_id = tasks.id AND task_references.user_id = auth.uid()
      )
    )
  )
);

DROP POLICY IF EXISTS "task_chat_log_items_select_task_access_with_references" ON public.task_chat_log_items;
DROP POLICY IF EXISTS "task_chat_log_items_select_task_access" ON public.task_chat_log_items;
CREATE POLICY "task_chat_log_items_select_task_access_with_references"
ON public.task_chat_log_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.task_chat_logs
    JOIN public.tasks ON tasks.id = task_chat_logs.task_id
    WHERE task_chat_logs.id = task_chat_log_items.log_id
    AND (
      is_admin((SELECT auth.uid()))
      OR auth.uid() = tasks.assigner_id OR auth.uid() = tasks.assignee_id
      OR EXISTS (
        SELECT 1 FROM public.task_references
        WHERE task_references.task_id = tasks.id AND task_references.user_id = auth.uid()
      )
    )
  )
);

-- ============================================================================
-- Phase 2: remove_task_from_lists_on_unpublish 트리거/함수 제거 (is_public 삭제에 따른)
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_remove_task_from_lists_on_unpublish ON public.tasks;
DROP FUNCTION IF EXISTS public.remove_task_from_lists_on_unpublish();

-- ============================================================================
-- Phase 3: 읽음 처리 함수
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_message_as_read(message_id UUID, reader_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  task_record RECORD;
  message_sender_id UUID;
  is_reader_assigner BOOLEAN;
  is_reader_assignee BOOLEAN;
  is_reader_reference BOOLEAN;
BEGIN
  SELECT m.user_id, t.id as task_id, t.assigner_id, t.assignee_id INTO task_record
  FROM public.messages m
  JOIN public.tasks t ON m.task_id = t.id
  WHERE m.id = message_id AND m.deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Message not found'; END IF;

  message_sender_id := task_record.user_id;
  is_reader_assigner := (reader_id = task_record.assigner_id);
  is_reader_assignee := (reader_id = task_record.assignee_id);
  is_reader_reference := EXISTS (
    SELECT 1 FROM public.task_references
    WHERE task_id = task_record.task_id AND user_id = reader_id
  );

  IF NOT (is_reader_assigner OR is_reader_assignee OR is_reader_reference) THEN RETURN; END IF;
  IF reader_id = message_sender_id THEN RETURN; END IF;

  UPDATE public.messages
  SET read_by = COALESCE(read_by, '[]'::jsonb) || jsonb_build_array(reader_id::text)
  WHERE id = message_id AND NOT (read_by ? reader_id::text);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_task_messages_as_read(task_id_param UUID, reader_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  task_record RECORD;
  is_reader_assigner BOOLEAN;
  is_reader_assignee BOOLEAN;
  is_reader_reference BOOLEAN;
BEGIN
  SELECT id, assigner_id, assignee_id INTO task_record FROM public.tasks WHERE id = task_id_param;
  IF NOT FOUND THEN RAISE EXCEPTION 'Task not found'; END IF;

  is_reader_assigner := (reader_id = task_record.assigner_id);
  is_reader_assignee := (reader_id = task_record.assignee_id);
  is_reader_reference := EXISTS (
    SELECT 1 FROM public.task_references
    WHERE task_id = task_record.id AND user_id = reader_id
  );

  IF NOT (is_reader_assigner OR is_reader_assignee OR is_reader_reference) THEN RETURN; END IF;

  UPDATE public.messages
  SET read_by = COALESCE(read_by, '[]'::jsonb) || jsonb_build_array(reader_id::text)
  WHERE task_id = task_id_param AND deleted_at IS NULL AND user_id != reader_id
    AND NOT (read_by ? reader_id::text);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_unread_message_count(p_task_id UUID, p_user_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_assigner_id UUID; v_assignee_id UUID; v_is_reference BOOLEAN; v_count INTEGER;
BEGIN
  SELECT assigner_id, assignee_id INTO v_assigner_id, v_assignee_id
  FROM public.tasks WHERE id = p_task_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  v_is_reference := EXISTS (
    SELECT 1 FROM public.task_references
    WHERE task_id = p_task_id AND user_id = p_user_id
  );
  IF p_user_id != v_assigner_id AND p_user_id != v_assignee_id AND NOT v_is_reference THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.messages
  WHERE task_id = p_task_id AND user_id != p_user_id AND deleted_at IS NULL
    AND (read_by IS NULL OR NOT (read_by ? p_user_id::text));
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_unread_message_counts(p_task_ids UUID[], p_user_id UUID)
RETURNS TABLE(result_task_id UUID, unread_count INTEGER) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_task_id UUID; v_assigner_id UUID; v_assignee_id UUID; v_is_reference BOOLEAN; v_count INTEGER;
BEGIN
  FOREACH v_task_id IN ARRAY p_task_ids LOOP
    SELECT assigner_id, assignee_id INTO v_assigner_id, v_assignee_id
    FROM public.tasks WHERE id = v_task_id;
    IF NOT FOUND THEN result_task_id := v_task_id; unread_count := 0; RETURN NEXT; CONTINUE; END IF;

    v_is_reference := EXISTS (
      SELECT 1 FROM public.task_references
      WHERE task_id = v_task_id AND user_id = p_user_id
    );
    IF p_user_id != v_assigner_id AND p_user_id != v_assignee_id AND NOT v_is_reference THEN
      result_task_id := v_task_id; unread_count := 0; RETURN NEXT; CONTINUE;
    END IF;

    SELECT COUNT(*) INTO v_count FROM public.messages
    WHERE task_id = v_task_id AND user_id != p_user_id AND deleted_at IS NULL
      AND (read_by IS NULL OR NOT (read_by ? p_user_id::text));
    result_task_id := v_task_id; unread_count := v_count; RETURN NEXT;
  END LOOP;
END;
$$;

-- ============================================================================
-- Phase 4: 참조자 이메일 Edge Function 호출 함수 및 트리거
-- ============================================================================
-- ⚠️ 하드코딩: v_function_url, v_service_role_key (파일 상단 참고)

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

  FOR v_task_id IN (SELECT DISTINCT task_id FROM inserted_references) LOOP
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

DROP TRIGGER IF EXISTS trigger_send_reference_email ON public.task_references;
CREATE TRIGGER trigger_send_reference_email
  AFTER INSERT ON public.task_references
  REFERENCING NEW TABLE AS inserted_references
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.send_task_reference_email();

-- ============================================================================
-- Phase 4: 상태 변경 시 참조자 이메일 트리거
-- ============================================================================
-- ⚠️ 하드코딩: v_function_url, v_service_role_key (파일 상단 참고)

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

DROP TRIGGER IF EXISTS trigger_send_reference_email_on_status_change ON public.tasks;
CREATE TRIGGER trigger_send_reference_email_on_status_change
  AFTER UPDATE OF task_status ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.send_task_reference_email_on_status_change();

-- ============================================================================
-- Phase 5: is_public 제거
-- ============================================================================

DROP INDEX IF EXISTS idx_tasks_is_public;
ALTER TABLE public.tasks DROP COLUMN IF EXISTS is_public;
