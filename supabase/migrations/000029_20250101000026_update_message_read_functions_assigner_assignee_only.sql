-- Update message read functions to only allow assigner/assignee to mark messages as read
-- This migration updates the read functions to enforce the policy that only assigner ↔ assignee
-- can mark messages as read, excluding Admin users who are not assigner/assignee.

-- 1. Update mark_message_as_read function
-- Only assigner ↔ assignee can mark messages as read
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
  is_sender_assigner BOOLEAN;
  is_sender_assignee BOOLEAN;
BEGIN
  -- 메시지와 Task 정보 조회
  SELECT 
    m.user_id,
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
  
  -- 읽는 사람이 assigner/assignee인지 확인
  is_reader_assigner := (reader_id = task_record.assigner_id);
  is_reader_assignee := (reader_id = task_record.assignee_id);
  
  -- 보낸 사람이 assigner/assignee인지 확인
  is_sender_assigner := (message_sender_id = task_record.assigner_id);
  is_sender_assignee := (message_sender_id = task_record.assignee_id);
  
  -- 읽는 사람이 assigner 또는 assignee가 아니면 처리하지 않음 (Admin 제3자 차단)
  IF NOT (is_reader_assigner OR is_reader_assignee) THEN
    RETURN;
  END IF;
  
  -- 읽음 처리 조건 확인
  -- 1. 지시자가 보낸 메시지 → 담당자가 읽은 경우만 처리
  -- 2. 담당자가 보낸 메시지 → 지시자가 읽은 경우만 처리
  -- 3. 관리자가 지시자/담당자인 경우는 일반 사용자와 동일하게 처리
  
  IF (is_sender_assigner AND is_reader_assignee) OR
     (is_sender_assignee AND is_reader_assigner) THEN
    -- 읽음 처리: read_by 배열에 추가 (중복 방지)
    UPDATE public.messages
    SET read_by = COALESCE(read_by, '[]'::jsonb) || jsonb_build_array(reader_id::text)
    WHERE id = message_id
      AND NOT (read_by ? reader_id::text);
  END IF;
END;
$$;

-- 2. Update mark_task_messages_as_read function
-- Only assigner ↔ assignee can mark messages as read
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
BEGIN
  -- Task 정보 조회
  SELECT assigner_id, assignee_id
  INTO task_record
  FROM public.tasks
  WHERE id = task_id_param;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;
  
  -- 읽는 사람이 assigner/assignee인지 확인
  is_reader_assigner := (reader_id = task_record.assigner_id);
  is_reader_assignee := (reader_id = task_record.assignee_id);
  
  -- 읽는 사람이 assigner 또는 assignee가 아니면 처리하지 않음 (Admin 제3자 차단)
  IF NOT (is_reader_assigner OR is_reader_assignee) THEN
    RETURN;
  END IF;
  
  -- Task의 모든 메시지에 대해 읽음 처리
  -- 단, 상대방(assigner 또는 assignee)이 보낸 메시지만 처리
  UPDATE public.messages
  SET read_by = COALESCE(read_by, '[]'::jsonb) || jsonb_build_array(reader_id::text)
  WHERE task_id = task_id_param
    AND deleted_at IS NULL  -- 삭제되지 않은 메시지만
    AND (
      -- 지시자가 읽는 경우: 담당자가 보낸 메시지만 읽음 처리
      (is_reader_assigner AND user_id = task_record.assignee_id) OR
      -- 담당자가 읽는 경우: 지시자가 보낸 메시지만 읽음 처리
      (is_reader_assignee AND user_id = task_record.assigner_id)
    )
    AND NOT (read_by ? reader_id::text);  -- 중복 방지
END;
$$;

-- 3. Update function comments
COMMENT ON FUNCTION public.mark_message_as_read(UUID, UUID) IS 
'Mark a single message as read by a user. Only assigner ↔ assignee can mark messages as read. Admin users who are not assigner/assignee cannot mark messages as read.';

COMMENT ON FUNCTION public.mark_task_messages_as_read(UUID, UUID) IS 
'Mark all messages in a task as read by a user. Only assigner ↔ assignee can mark messages as read. Admin users who are not assigner/assignee cannot mark messages as read.';


