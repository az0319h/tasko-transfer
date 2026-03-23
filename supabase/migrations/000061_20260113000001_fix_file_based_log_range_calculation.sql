-- Fix file-based log range calculation
-- 첫 로그 범위를 "시작 버튼(IN_PROGRESS 상태 변경) 이후"부터 첫 파일 전송까지로 수정
-- 기존: START 타입 로그의 created_at 사용 (파일 업로드 시점)
-- 수정: IN_PROGRESS 상태 변경 시 생성된 SYSTEM 메시지의 created_at 사용

CREATE OR REPLACE FUNCTION public.create_chat_log_on_file_upload()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
  v_last_log_created_at TIMESTAMPTZ;
  v_task_start_time TIMESTAMPTZ;
  v_message_record RECORD;
  v_position INTEGER := 0;
  v_file_names TEXT[] := ARRAY[]::TEXT[];
  v_title TEXT;
BEGIN
  -- Only process if this is a log anchor (last message of a file-including bundle)
  IF NEW.is_log_anchor IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Get task start time: IN_PROGRESS 상태 변경 시 생성된 SYSTEM 메시지의 created_at
  -- 요구사항: "시작 버튼을 누른 시점 이후부터" 첫 파일 전송까지
  -- SYSTEM 메시지가 없으면 Task 생성 시간 사용 (fallback)
  SELECT 
    COALESCE(
      (SELECT created_at FROM public.messages 
       WHERE task_id = NEW.task_id 
       AND message_type = 'SYSTEM'
       AND content LIKE '%진행 중%'
       ORDER BY created_at ASC LIMIT 1),
      (SELECT created_at FROM public.tasks WHERE id = NEW.task_id)
    ) INTO v_task_start_time;

  -- Get last log's created_at for this task
  SELECT created_at INTO v_last_log_created_at
  FROM public.task_chat_logs
  WHERE task_id = NEW.task_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- Collect file names from this bundle for the log title
  SELECT ARRAY_AGG(file_name ORDER BY created_at ASC)
  INTO v_file_names
  FROM public.messages
  WHERE task_id = NEW.task_id
    AND bundle_id = NEW.bundle_id
    AND message_type = 'FILE'
    AND file_name IS NOT NULL;

  -- Create title from file names (comma-separated)
  IF v_file_names IS NOT NULL AND array_length(v_file_names, 1) > 0 THEN
    v_title := array_to_string(v_file_names, ', ');
  ELSE
    -- Fallback: use bundle_id if no file names found (shouldn't happen, but safety)
    v_title := 'Files';
  END IF;

  -- Create the log
  INSERT INTO public.task_chat_logs (
    task_id,
    created_by,
    log_type,
    title,
    created_at
  ) VALUES (
    NEW.task_id,
    NEW.user_id,
    'START'::chat_log_type, -- File upload logs use START type
    v_title,
    NEW.created_at -- Use anchor message's created_at as log timestamp
  )
  RETURNING id INTO v_log_id;

  -- Collect all messages in the range:
  -- - If last log exists: from last_log_created_at (exclusive) to current anchor (inclusive)
  -- - If no last log: from task_start_time (inclusive) to current anchor (inclusive)
  -- 요구사항: "이전 로그 이후부터 → 이번 파일 포함 전송의 끝까지"
  FOR v_message_record IN
    SELECT id, created_at
    FROM public.messages
    WHERE task_id = NEW.task_id
      AND message_type IN ('USER', 'FILE')
      AND deleted_at IS NULL
      AND (
        -- If last log exists: messages after last log (exclusive)
        (v_last_log_created_at IS NOT NULL AND created_at > v_last_log_created_at)
        OR
        -- If no last log: messages after task start (inclusive)
        (v_last_log_created_at IS NULL AND created_at >= v_task_start_time)
      )
      AND created_at <= NEW.created_at -- Up to and including the anchor message
    ORDER BY created_at ASC
  LOOP
    INSERT INTO public.task_chat_log_items (
      log_id,
      message_id,
      position
    ) VALUES (
      v_log_id,
      v_message_record.id,
      v_position
    )
    ON CONFLICT (log_id, message_id) DO NOTHING; -- Prevent duplicates
    
    v_position := v_position + 1;
  END LOOP;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the message insert
    RAISE WARNING 'Failed to create chat log on file upload: %', SQLERRM;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.create_chat_log_on_file_upload() IS 'Creates a chat log when a file upload bundle completes (is_log_anchor=true). References messages from last log to current anchor. First log starts from IN_PROGRESS status change (start button) time.';
