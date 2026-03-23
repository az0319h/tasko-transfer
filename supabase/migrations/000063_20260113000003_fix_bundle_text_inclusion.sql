-- Fix bundle text inclusion in logs
-- 파일+텍스트 동시 업로드 시 텍스트가 로그에 포함되지 않는 문제 해결
-- 옵션 A: anchor 생성 시 bundle_id 전체 수집

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
  v_bundle_message_record RECORD;
  v_position INTEGER := 0;
  v_file_names TEXT[] := ARRAY[]::TEXT[];
  v_title TEXT;
  v_collected_message_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  -- Only process if this is a log anchor (last message of a file-including bundle)
  IF NEW.is_log_anchor IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Get task start time: IN_PROGRESS 상태 변경 시 생성된 SYSTEM 메시지의 created_at
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
    'START'::chat_log_type,
    v_title,
    NEW.created_at
  )
  RETURNING id INTO v_log_id;

  -- Step 1: Collect messages in the range (기존 로직)
  -- - If last log exists: from last_log_created_at (exclusive) to current anchor (inclusive)
  -- - If no last log: from task_start_time (inclusive) to current anchor (inclusive)
  FOR v_message_record IN
    SELECT id, created_at
    FROM public.messages
    WHERE task_id = NEW.task_id
      AND message_type IN ('USER', 'FILE')
      AND deleted_at IS NULL
      AND (
        (v_last_log_created_at IS NOT NULL AND created_at > v_last_log_created_at)
        OR
        (v_last_log_created_at IS NULL AND created_at >= v_task_start_time)
      )
      AND created_at <= NEW.created_at
    ORDER BY created_at ASC
  LOOP
    -- 중복 체크를 위해 수집된 메시지 ID 배열에 추가
    v_collected_message_ids := array_append(v_collected_message_ids, v_message_record.id);
    
    INSERT INTO public.task_chat_log_items (
      log_id,
      message_id,
      position
    ) VALUES (
      v_log_id,
      v_message_record.id,
      v_position
    )
    ON CONFLICT (log_id, message_id) DO NOTHING;
    
    v_position := v_position + 1;
  END LOOP;

  -- Step 2: 강제로 bundle_id에 속한 모든 메시지 포함 (파일+텍스트 동시 전송 시 텍스트 누락 방지)
  -- 같은 bundle_id로 업로드된 메시지 중 아직 포함되지 않은 메시지를 추가
  FOR v_bundle_message_record IN
    SELECT id, created_at
    FROM public.messages
    WHERE task_id = NEW.task_id
      AND bundle_id = NEW.bundle_id
      AND message_type IN ('USER', 'FILE')
      AND deleted_at IS NULL
      AND NOT (id = ANY(v_collected_message_ids)) -- 이미 포함된 메시지는 제외
    ORDER BY created_at ASC
  LOOP
    INSERT INTO public.task_chat_log_items (
      log_id,
      message_id,
      position
    ) VALUES (
      v_log_id,
      v_bundle_message_record.id,
      v_position
    )
    ON CONFLICT (log_id, message_id) DO NOTHING; -- 중복 방지
    
    v_position := v_position + 1;
  END LOOP;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to create chat log on file upload: %', SQLERRM;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.create_chat_log_on_file_upload() IS 'Creates a chat log when a file upload bundle completes (is_log_anchor=true). References messages from last log to current anchor, and ensures all messages with the same bundle_id are included (fixes text message exclusion issue).';
