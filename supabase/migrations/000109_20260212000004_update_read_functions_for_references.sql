-- ============================================================================
-- Phase 3: 읽음 처리 함수 수정 - 참조자 조건 추가
-- ============================================================================
-- 목적: 참조자도 메시지 읽음 처리를 할 수 있도록 함수 수정
-- 
-- 변경 사항:
-- 1. mark_message_as_read: 참조자도 메시지 읽음 처리 가능
-- 2. mark_task_messages_as_read: 참조자도 Task의 모든 메시지 읽음 처리 가능
-- 3. get_unread_message_count: 참조자도 미읽음 메시지 수 조회 가능
-- 4. get_unread_message_counts: 참조자도 여러 Task의 미읽음 메시지 수 조회 가능
-- 
-- 참조자 읽음 처리 로직:
-- - 참조자는 지시자, 담당자, 다른 참조자가 보낸 메시지를 읽음 처리 가능
-- - 참조자가 보낸 메시지는 지시자, 담당자, 다른 참조자가 읽음 처리 가능
-- - 자신이 보낸 메시지는 읽음 처리하지 않음
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. mark_message_as_read 함수 수정 (3-1)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mark_message_as_read(
  message_id UUID,
  reader_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  task_record RECORD;
  message_sender_id UUID;
  is_reader_assigner BOOLEAN;
  is_reader_assignee BOOLEAN;
  is_reader_reference BOOLEAN;
BEGIN
  -- 메시지와 Task 정보 조회
  SELECT 
    m.user_id,
    t.id as task_id,
    t.assigner_id,
    t.assignee_id
  INTO task_record
  FROM public.messages m
  JOIN public.tasks t ON m.task_id = t.id
  WHERE m.id = message_id
    AND m.deleted_at IS NULL;  -- 삭제되지 않은 메시지만
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found';
  END IF;
  
  message_sender_id := task_record.user_id;
  
  -- 읽는 사람이 assigner/assignee/참조자인지 확인
  is_reader_assigner := (reader_id = task_record.assigner_id);
  is_reader_assignee := (reader_id = task_record.assignee_id);
  is_reader_reference := EXISTS (
    SELECT 1 FROM public.task_references
    WHERE task_id = task_record.task_id
    AND user_id = reader_id
  );
  
  -- 읽는 사람이 assigner, assignee, 참조자가 아니면 처리하지 않음 (Admin 제3자 차단)
  IF NOT (is_reader_assigner OR is_reader_assignee OR is_reader_reference) THEN
    RETURN;
  END IF;
  
  -- 자신이 보낸 메시지는 읽음 처리하지 않음
  IF reader_id = message_sender_id THEN
    RETURN;
  END IF;
  
  -- 읽음 처리: read_by 배열에 추가 (중복 방지)
  UPDATE public.messages
  SET read_by = COALESCE(read_by, '[]'::jsonb) || jsonb_build_array(reader_id::text)
  WHERE id = message_id
    AND NOT (read_by ? reader_id::text);
END;
$$;

COMMENT ON FUNCTION public.mark_message_as_read(UUID, UUID) IS 
'Mark a single message as read by a user. Assigner, assignee, and references can mark messages as read. Admin users who are not assigner/assignee/reference cannot mark messages as read. Users cannot mark their own messages as read.';

-- ----------------------------------------------------------------------------
-- 2. mark_task_messages_as_read 함수 수정 (3-2)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mark_task_messages_as_read(
  task_id_param UUID,
  reader_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  task_record RECORD;
  is_reader_assigner BOOLEAN;
  is_reader_assignee BOOLEAN;
  is_reader_reference BOOLEAN;
BEGIN
  -- Task 정보 조회
  SELECT id, assigner_id, assignee_id
  INTO task_record
  FROM public.tasks
  WHERE id = task_id_param;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;
  
  -- 읽는 사람이 assigner/assignee/참조자인지 확인
  is_reader_assigner := (reader_id = task_record.assigner_id);
  is_reader_assignee := (reader_id = task_record.assignee_id);
  is_reader_reference := EXISTS (
    SELECT 1 FROM public.task_references
    WHERE task_id = task_record.id
    AND user_id = reader_id
  );
  
  -- 읽는 사람이 assigner, assignee, 참조자가 아니면 처리하지 않음 (Admin 제3자 차단)
  IF NOT (is_reader_assigner OR is_reader_assignee OR is_reader_reference) THEN
    RETURN;
  END IF;
  
  -- Task의 모든 메시지에 대해 읽음 처리
  -- 단, 자신이 보낸 메시지는 제외
  UPDATE public.messages
  SET read_by = COALESCE(read_by, '[]'::jsonb) || jsonb_build_array(reader_id::text)
  WHERE task_id = task_id_param
    AND deleted_at IS NULL  -- 삭제되지 않은 메시지만
    AND user_id != reader_id  -- 자신이 보낸 메시지는 제외
    AND NOT (read_by ? reader_id::text);  -- 중복 방지
END;
$$;

COMMENT ON FUNCTION public.mark_task_messages_as_read(UUID, UUID) IS 
'Mark all messages in a task as read by a user. Assigner, assignee, and references can mark messages as read. Admin users who are not assigner/assignee/reference cannot mark messages as read. Users cannot mark their own messages as read.';

-- ----------------------------------------------------------------------------
-- 3. get_unread_message_count 함수 수정 (3-3)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_unread_message_count(
  p_task_id UUID,
  p_user_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_assigner_id UUID;
  v_assignee_id UUID;
  v_is_reference BOOLEAN;
  v_count INTEGER;
BEGIN
  -- Task의 지시자/담당자 조회
  SELECT assigner_id, assignee_id 
  INTO v_assigner_id, v_assignee_id
  FROM public.tasks 
  WHERE id = p_task_id;
  
  -- Task가 존재하지 않으면 0 반환
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  -- 현재 사용자가 참조자인지 확인
  v_is_reference := EXISTS (
    SELECT 1 FROM public.task_references
    WHERE task_id = p_task_id
    AND user_id = p_user_id
  );
  
  -- 현재 사용자가 지시자/담당자/참조자가 아니면 0 반환
  IF p_user_id != v_assigner_id AND p_user_id != v_assignee_id AND NOT v_is_reference THEN
    RETURN 0;
  END IF;
  
  -- 읽지 않은 메시지 수 계산
  -- 다른 사람(지시자, 담당자, 참조자)이 보낸 메시지 중 read_by에 현재 사용자 ID가 없는 메시지 수
  SELECT COUNT(*) INTO v_count
  FROM public.messages
  WHERE task_id = p_task_id
    AND user_id != p_user_id  -- 자신이 보낸 메시지는 제외
    AND deleted_at IS NULL
    AND (
      read_by IS NULL 
      OR NOT (read_by ? p_user_id::text)
    );
  
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.get_unread_message_count(UUID, UUID) IS 
'Get the count of unread messages in a task for a specific user. Supports assigner, assignee, and references. Returns count of messages sent by others that have not been read by the user.';

-- ----------------------------------------------------------------------------
-- 4. get_unread_message_counts 함수 수정 (3-3)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_unread_message_counts(
  p_task_ids UUID[],
  p_user_id UUID
)
RETURNS TABLE(result_task_id UUID, unread_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task_id UUID;
  v_assigner_id UUID;
  v_assignee_id UUID;
  v_is_reference BOOLEAN;
  v_count INTEGER;
BEGIN
  -- 각 Task에 대해 읽지 않은 메시지 수 계산
  FOREACH v_task_id IN ARRAY p_task_ids
  LOOP
    -- Task의 지시자/담당자 조회
    SELECT assigner_id, assignee_id 
    INTO v_assigner_id, v_assignee_id
    FROM public.tasks 
    WHERE id = v_task_id;
    
    -- Task가 존재하지 않으면 0 반환
    IF NOT FOUND THEN
      result_task_id := v_task_id;
      unread_count := 0;
      RETURN NEXT;
      CONTINUE;
    END IF;
    
    -- 현재 사용자가 참조자인지 확인
    v_is_reference := EXISTS (
      SELECT 1 FROM public.task_references
      WHERE task_id = v_task_id
      AND user_id = p_user_id
    );
    
    -- 현재 사용자가 지시자/담당자/참조자가 아니면 0 반환
    IF p_user_id != v_assigner_id AND p_user_id != v_assignee_id AND NOT v_is_reference THEN
      result_task_id := v_task_id;
      unread_count := 0;
      RETURN NEXT;
      CONTINUE;
    END IF;
    
    -- 읽지 않은 메시지 수 계산
    -- 다른 사람(지시자, 담당자, 참조자)이 보낸 메시지 중 read_by에 현재 사용자 ID가 없는 메시지 수
    SELECT COUNT(*) INTO v_count
    FROM public.messages
    WHERE task_id = v_task_id
      AND user_id != p_user_id  -- 자신이 보낸 메시지는 제외
      AND deleted_at IS NULL
      AND (
        read_by IS NULL 
        OR NOT (read_by ? p_user_id::text)
      );
    
    result_task_id := v_task_id;
    unread_count := v_count;
    RETURN NEXT;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.get_unread_message_counts(UUID[], UUID) IS 
'Get the count of unread messages for multiple tasks for a specific user. Supports assigner, assignee, and references. Returns count of messages sent by others that have not been read by the user.';
