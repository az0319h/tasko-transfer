-- Database Trigger: Update message log counts when messages are inserted or deleted
-- This trigger updates file_count and text_count in message_logs table

-- Function: Update log count on message insert
CREATE OR REPLACE FUNCTION public.update_message_log_count_on_message_insert()
RETURNS TRIGGER AS $$
DECLARE
  last_log_id UUID;
  last_system_message_created_at TIMESTAMPTZ;
  task_status_val task_status;
  last_log_status task_status;
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

  -- 해당 Task의 마지막 로그 조회
  SELECT id, status INTO last_log_id, last_log_status
  FROM public.message_logs
  WHERE task_id = NEW.task_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- 마지막 로그가 없으면 카운트 업데이트 안 함 (아직 상태 변경이 없음)
  IF last_log_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 메시지가 해당 로그의 범위에 속하는지 확인
  IF EXISTS (
    SELECT 1
    FROM public.message_logs ml
    WHERE ml.id = last_log_id
      AND (
        -- 첫 로그인 경우: Task 생성 ~ 첫 SYSTEM 메시지
        (ml.previous_system_message_id IS NULL
          AND NEW.created_at < (SELECT created_at FROM public.messages WHERE id = ml.system_message_id))
        OR
        -- 중간 로그인 경우: 이전 SYSTEM 메시지 ~ 새 SYSTEM 메시지
        (ml.previous_system_message_id IS NOT NULL
          AND ml.status != 'REJECTED'
          AND ml.status != 'APPROVED'
          AND NEW.created_at > (SELECT created_at FROM public.messages WHERE id = ml.previous_system_message_id)
          AND NEW.created_at < (SELECT created_at FROM public.messages WHERE id = ml.system_message_id))
        OR
        -- 거부됨(REJECTED) 로그인 경우: 이전 SYSTEM 메시지 ~ 현재까지 (다음 상태 변경 시까지)
        (ml.previous_system_message_id IS NOT NULL
          AND ml.status = 'REJECTED'
          AND NEW.created_at > (SELECT created_at FROM public.messages WHERE id = ml.previous_system_message_id))
        OR
        -- 승인됨(APPROVED) 로그인 경우: 이전 SYSTEM 메시지 ~ 새 SYSTEM 메시지까지만 (이미 위에서 처리됨)
        (ml.status = 'APPROVED'
          AND ml.previous_system_message_id IS NOT NULL
          AND NEW.created_at > (SELECT created_at FROM public.messages WHERE id = ml.previous_system_message_id)
          AND NEW.created_at < (SELECT created_at FROM public.messages WHERE id = ml.system_message_id))
      )
  ) THEN
    -- 카운트 업데이트
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
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Failed to update message log count on insert: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Update log count on message delete (soft delete)
CREATE OR REPLACE FUNCTION public.update_message_log_count_on_message_delete()
RETURNS TRIGGER AS $$
DECLARE
  log_id UUID;
BEGIN
  -- 해당 메시지가 속한 로그 찾기
  SELECT id INTO log_id
  FROM public.message_logs
  WHERE task_id = OLD.task_id
    AND (
      -- 첫 로그인 경우: Task 생성 ~ 첫 SYSTEM 메시지
      (previous_system_message_id IS NULL
        AND OLD.created_at < (SELECT created_at FROM public.messages WHERE id = system_message_id))
      OR
      -- 중간/마지막 로그인 경우: 이전 SYSTEM 메시지 ~ 새 SYSTEM 메시지
      -- 거부됨(REJECTED) 로그의 경우: 이전 SYSTEM 메시지 ~ 현재까지
      (previous_system_message_id IS NOT NULL
        AND (
          -- 일반 로그: 이전 SYSTEM 메시지 ~ 새 SYSTEM 메시지
          (OLD.created_at > (SELECT created_at FROM public.messages WHERE id = previous_system_message_id)
            AND OLD.created_at < (SELECT created_at FROM public.messages WHERE id = system_message_id))
          OR
          -- 거부됨 로그: 이전 SYSTEM 메시지 ~ 현재까지
          (status = 'REJECTED'
            AND OLD.created_at > (SELECT created_at FROM public.messages WHERE id = previous_system_message_id))
        ))
    )
  ORDER BY created_at DESC
  LIMIT 1;

  -- 로그가 있으면 카운트 감소
  IF log_id IS NOT NULL THEN
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
  END IF;

  RETURN OLD;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Failed to update message log count on delete: %', SQLERRM;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거 등록
CREATE TRIGGER trigger_update_message_log_count_on_insert
  AFTER INSERT ON public.messages
  FOR EACH ROW
  WHEN (NEW.message_type IN ('FILE', 'USER'))
  EXECUTE FUNCTION public.update_message_log_count_on_message_insert();

CREATE TRIGGER trigger_update_message_log_count_on_delete
  AFTER UPDATE OF deleted_at ON public.messages
  FOR EACH ROW
  WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
  EXECUTE FUNCTION public.update_message_log_count_on_message_delete();

-- Add comments
COMMENT ON FUNCTION public.update_message_log_count_on_message_insert() IS 'Updates message log counts when a new message is inserted. Excludes messages after APPROVED status.';
COMMENT ON FUNCTION public.update_message_log_count_on_message_delete() IS 'Updates message log counts when a message is soft-deleted.';
COMMENT ON TRIGGER trigger_update_message_log_count_on_insert ON public.messages IS 'Updates message log counts when FILE or USER messages are inserted';
COMMENT ON TRIGGER trigger_update_message_log_count_on_delete ON public.messages IS 'Updates message log counts when messages are soft-deleted';
