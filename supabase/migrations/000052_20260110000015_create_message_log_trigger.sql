-- Database Trigger: Automatically create message log when task status changes
-- This trigger creates a log entry in message_logs table when task_status changes
-- IMPORTANT: This trigger must run AFTER the SYSTEM message creation trigger
-- Trigger naming: trigger_02_... ensures it runs after trigger_create_task_status_change_system_message

CREATE OR REPLACE FUNCTION public.create_message_log_on_status_change()
RETURNS TRIGGER AS $$
DECLARE
  new_status_label TEXT;
  log_title TEXT;
  system_message_id UUID;
  previous_system_message_id UUID;
  message_file_count INTEGER;
  message_text_count INTEGER;
  system_message_created_at TIMESTAMPTZ;
BEGIN
  -- 상태가 실제로 변경되었는지 확인
  IF OLD.task_status = NEW.task_status THEN
    RETURN NEW;
  END IF;

  -- 새 상태의 한글명 매핑
  new_status_label := CASE NEW.task_status
    WHEN 'ASSIGNED' THEN '할당됨'
    WHEN 'IN_PROGRESS' THEN '진행 중'
    WHEN 'WAITING_CONFIRM' THEN '확인 대기'
    WHEN 'APPROVED' THEN '승인됨'
    WHEN 'REJECTED' THEN '거부됨'
    ELSE NEW.task_status::TEXT
  END;

  -- 로그 제목 생성: "{새 상태} 이전 대화"
  log_title := new_status_label || ' 이전 대화';

  -- 방금 생성된 SYSTEM 메시지 ID 조회 (상태 변경 트리거에서 생성됨)
  -- 최신 SYSTEM 메시지 조회 (방금 생성된 것)
  SELECT id, created_at INTO system_message_id, system_message_created_at
  FROM public.messages
  WHERE task_id = NEW.id
    AND message_type = 'SYSTEM'
  ORDER BY created_at DESC
  LIMIT 1;

  -- SYSTEM 메시지를 찾을 수 없으면 에러 (트리거 순서 문제 가능성)
  IF system_message_id IS NULL THEN
    RAISE WARNING 'SYSTEM message not found for task % when creating log. This may indicate a trigger order issue.', NEW.id;
    RETURN NEW;
  END IF;

  -- 이전 SYSTEM 메시지 ID 조회 (첫 로그가 아닌 경우)
  SELECT id INTO previous_system_message_id
  FROM public.messages
  WHERE task_id = NEW.id
    AND message_type = 'SYSTEM'
    AND id != system_message_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- 이전 SYSTEM 메시지 ~ 새 SYSTEM 메시지 사이의 메시지 카운트 계산
  -- 첫 로그인 경우 (previous_system_message_id가 NULL): Task 생성 ~ 첫 SYSTEM 메시지 사이
  SELECT
    COUNT(*) FILTER (WHERE message_type = 'FILE' AND deleted_at IS NULL),
    COUNT(*) FILTER (WHERE message_type = 'USER' AND deleted_at IS NULL)
  INTO message_file_count, message_text_count
  FROM public.messages
  WHERE task_id = NEW.id
    AND message_type IN ('FILE', 'USER')
    AND deleted_at IS NULL
    AND (
      -- 첫 로그인 경우: Task 생성 ~ 첫 SYSTEM 메시지
      (previous_system_message_id IS NULL 
        AND created_at < system_message_created_at)
      OR
      -- 중간/마지막 로그인 경우: 이전 SYSTEM 메시지 ~ 새 SYSTEM 메시지
      (previous_system_message_id IS NOT NULL
        AND created_at > (SELECT created_at FROM public.messages WHERE id = previous_system_message_id)
        AND created_at < system_message_created_at)
    );

  -- 새 로그 생성 (SECURITY DEFINER로 RLS 정책 우회)
  INSERT INTO public.message_logs (
    task_id,
    title,
    status,
    system_message_id,
    previous_system_message_id,
    file_count,
    text_count,
    created_at
  ) VALUES (
    NEW.id,
    log_title,
    NEW.task_status,
    system_message_id,
    previous_system_message_id,
    COALESCE(message_file_count, 0),
    COALESCE(message_text_count, 0),
    system_message_created_at
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Failed to create message log: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거 등록 및 실행 순서 보장
-- 트리거 이름에 "02"를 추가하여 SYSTEM 메시지 생성 트리거 이후에 실행되도록 함
-- PostgreSQL에서는 트리거 이름의 알파벳 순서로 실행됨
CREATE TRIGGER trigger_02_create_message_log_on_status_change
  AFTER UPDATE OF task_status ON public.tasks
  FOR EACH ROW
  WHEN (OLD.task_status IS DISTINCT FROM NEW.task_status)
  EXECUTE FUNCTION public.create_message_log_on_status_change();

-- Add comments
COMMENT ON FUNCTION public.create_message_log_on_status_change() IS 'Trigger function that creates message logs when task status changes. Must run after SYSTEM message creation trigger.';
COMMENT ON TRIGGER trigger_02_create_message_log_on_status_change ON public.tasks IS 'Automatically creates message log when task status changes (runs after SYSTEM message creation trigger)';
