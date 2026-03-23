-- Final migration: Add functions to get unread message count for tasks
-- These functions calculate the number of unread messages for a user in a task
-- Only assigner ↔ assignee can have unread messages (Admin users who are not assigner/assignee will get 0)
--
-- This migration consolidates:
-- - 20260129000010_add_unread_message_count_functions.sql
-- - 20260129000011_fix_unread_message_counts_function.sql

-- 1. Function to get unread message count for a single task
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
  v_counterpart_id UUID;
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
  
  -- 현재 사용자가 지시자/담당자인지 확인
  IF p_user_id != v_assigner_id AND p_user_id != v_assignee_id THEN
    RETURN 0;
  END IF;
  
  -- 상대방 ID 결정
  v_counterpart_id := CASE 
    WHEN p_user_id = v_assigner_id THEN v_assignee_id
    ELSE v_assigner_id
  END;
  
  -- 상대방이 없으면 0 반환
  IF v_counterpart_id IS NULL THEN
    RETURN 0;
  END IF;
  
  -- 읽지 않은 메시지 수 계산
  -- 상대방이 보낸 메시지 중 read_by에 현재 사용자 ID가 없는 메시지 수
  SELECT COUNT(*) INTO v_count
  FROM public.messages
  WHERE task_id = p_task_id
    AND user_id = v_counterpart_id
    AND deleted_at IS NULL
    AND (
      read_by IS NULL 
      OR NOT (read_by ? p_user_id::text)
    );
  
  RETURN COALESCE(v_count, 0);
END;
$$;

-- 2. Function to get unread message counts for multiple tasks (batch query)
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
  v_counterpart_id UUID;
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
    
    -- 현재 사용자가 지시자/담당자인지 확인
    IF p_user_id != v_assigner_id AND p_user_id != v_assignee_id THEN
      result_task_id := v_task_id;
      unread_count := 0;
      RETURN NEXT;
      CONTINUE;
    END IF;
    
    -- 상대방 ID 결정
    v_counterpart_id := CASE 
      WHEN p_user_id = v_assigner_id THEN v_assignee_id
      ELSE v_assigner_id
    END;
    
    -- 상대방이 없으면 0 반환
    IF v_counterpart_id IS NULL THEN
      result_task_id := v_task_id;
      unread_count := 0;
      RETURN NEXT;
      CONTINUE;
    END IF;
    
    -- 읽지 않은 메시지 수 계산
    SELECT COUNT(*) INTO v_count
    FROM public.messages m
    WHERE m.task_id = v_task_id
      AND m.user_id = v_counterpart_id
      AND m.deleted_at IS NULL
      AND (
        m.read_by IS NULL 
        OR NOT (m.read_by ? p_user_id::text)
      );
    
    result_task_id := v_task_id;
    unread_count := COALESCE(v_count, 0);
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$;

-- 3. Add function comments
COMMENT ON FUNCTION public.get_unread_message_count(UUID, UUID) IS 
'Get the count of unread messages for a user in a task. Only assigner ↔ assignee can have unread messages. Returns 0 if the user is not assigner/assignee or if the task does not exist.';

COMMENT ON FUNCTION public.get_unread_message_counts(UUID[], UUID) IS 
'Get the count of unread messages for a user across multiple tasks (batch query). Returns a table with result_task_id and unread_count. Only assigner ↔ assignee can have unread messages.';
