-- Fix: 로그 범위를 "이전 SYSTEM 메시지 ~ 현재 SYSTEM 메시지"로 제한
-- 로그 박스는 상태 변경 이전의 메시지만 포함해야 함
-- 상태 변경 이후의 메시지는 일반 채팅으로 표시되어야 함

-- Function: Update log count on message insert (수정)
CREATE OR REPLACE FUNCTION public.update_message_log_count_on_message_insert()
RETURNS TRIGGER AS $$
DECLARE
  last_log_id UUID;
  last_system_message_created_at TIMESTAMPTZ;
  task_status_val task_status;
  last_log_status task_status;
  log_previous_system_msg_id UUID;
  log_system_msg_id UUID;
  log_status_val task_status;
  log_system_msg_time TIMESTAMPTZ;
  is_in_range BOOLEAN := false;
BEGIN
  -- 삭제된 메시지는 카운트하지 않음
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Task 상태 확인
  SELECT task_status INTO task_status_val
  FROM public.tasks
  WHERE id = NEW.task_id;

  -- 승인됨(APPROVED) 이후 메시지는 로그 카운트에 포함하지 않음 (최종 상태)
  IF task_status_val = 'APPROVED' THEN
    -- 마지막 로그의 SYSTEM 메시지 시간 확인
    SELECT ml.id, ml.status, m.created_at INTO last_log_id, last_log_status, last_system_message_created_at
    FROM public.message_logs ml
    JOIN public.messages m ON m.id = ml.system_message_id
    WHERE ml.task_id = NEW.task_id
      AND ml.status = 'APPROVED'
    ORDER BY ml.created_at DESC
    LIMIT 1;

    -- 승인됨 SYSTEM 메시지 이후의 메시지는 카운트하지 않음
    IF last_system_message_created_at IS NOT NULL AND NEW.created_at > last_system_message_created_at THEN
      RETURN NEW; -- 카운트 업데이트 안 함
    END IF;
  END IF;

  -- 해당 Task의 모든 로그를 순회하며 메시지가 속한 로그 찾기
  FOR last_log_id, log_previous_system_msg_id, log_system_msg_id, log_status_val IN
    SELECT id, previous_system_message_id, system_message_id, status
    FROM public.message_logs
    WHERE task_id = NEW.task_id
    ORDER BY created_at DESC
  LOOP
    -- 현재 로그의 SYSTEM 메시지 시간 조회
    SELECT created_at INTO log_system_msg_time
    FROM public.messages
    WHERE id = log_system_msg_id;

    -- 첫 로그인 경우: Task 생성 ~ 첫 SYSTEM 메시지 (SYSTEM 메시지 제외)
    IF log_previous_system_msg_id IS NULL THEN
      is_in_range := NEW.created_at < log_system_msg_time;
    -- 중간/마지막 로그인 경우: 이전 SYSTEM 메시지 ~ 현재 SYSTEM 메시지 (현재 SYSTEM 메시지 제외)
    ELSE
      is_in_range := NEW.created_at > (SELECT created_at FROM public.messages WHERE id = log_previous_system_msg_id)
        AND NEW.created_at < log_system_msg_time;
    END IF;

    -- 범위에 속하면 해당 로그의 카운트 업데이트
    IF is_in_range THEN
      IF NEW.message_type = 'FILE' THEN
        UPDATE public.message_logs
        SET file_count = file_count + 1,
            updated_at = now()
        WHERE id = last_log_id;
      ELSIF NEW.message_type = 'USER' THEN
        UPDATE public.message_logs
        SET text_count = text_count + 1,
            updated_at = now()
        WHERE id = last_log_id;
      END IF;
      EXIT; -- 첫 번째로 매칭되는 로그에서 종료
    END IF;
  END LOOP;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Failed to update message log count on insert: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Update log count on message delete (수정)
CREATE OR REPLACE FUNCTION public.update_message_log_count_on_message_delete()
RETURNS TRIGGER AS $$
DECLARE
  log_id UUID;
  log_previous_system_msg_id UUID;
  log_system_msg_id UUID;
  log_status_val task_status;
  log_system_msg_time TIMESTAMPTZ;
  is_in_range BOOLEAN := false;
BEGIN
  -- 모든 로그를 순회하며 메시지가 속한 로그 찾기
  FOR log_id, log_previous_system_msg_id, log_system_msg_id, log_status_val IN
    SELECT id, previous_system_message_id, system_message_id, status
    FROM public.message_logs
    WHERE task_id = OLD.task_id
    ORDER BY created_at DESC
  LOOP
    -- 현재 로그의 SYSTEM 메시지 시간 조회
    SELECT created_at INTO log_system_msg_time
    FROM public.messages
    WHERE id = log_system_msg_id;

    -- 첫 로그인 경우: Task 생성 ~ 첫 SYSTEM 메시지 (SYSTEM 메시지 제외)
    IF log_previous_system_msg_id IS NULL THEN
      is_in_range := OLD.created_at < log_system_msg_time;
    -- 중간/마지막 로그인 경우: 이전 SYSTEM 메시지 ~ 현재 SYSTEM 메시지 (현재 SYSTEM 메시지 제외)
    ELSE
      is_in_range := OLD.created_at > (SELECT created_at FROM public.messages WHERE id = log_previous_system_msg_id)
        AND OLD.created_at < log_system_msg_time;
    END IF;

    -- 범위에 속하면 해당 로그의 카운트 감소
    IF is_in_range THEN
      IF OLD.message_type = 'FILE' THEN
        UPDATE public.message_logs
        SET file_count = GREATEST(file_count - 1, 0),
            updated_at = now()
        WHERE id = log_id;
      ELSIF OLD.message_type = 'USER' THEN
        UPDATE public.message_logs
        SET text_count = GREATEST(text_count - 1, 0),
            updated_at = now()
        WHERE id = log_id;
      END IF;
      EXIT; -- 첫 번째로 매칭되는 로그에서 종료
    END IF;
  END LOOP;

  RETURN OLD;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Failed to update message log count on delete: %', SQLERRM;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON FUNCTION public.update_message_log_count_on_message_insert() IS 'Updates message log counts when a new message is inserted. Logs only include messages before status change (previous SYSTEM message ~ current SYSTEM message, excluding current SYSTEM message).';
COMMENT ON FUNCTION public.update_message_log_count_on_message_delete() IS 'Updates message log counts when a message is soft-deleted. Logs only include messages before status change (previous SYSTEM message ~ current SYSTEM message, excluding current SYSTEM message).';
