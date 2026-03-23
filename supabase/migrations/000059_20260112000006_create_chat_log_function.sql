-- Create function to generate chat log when task status changes
-- This function is called from the status change API endpoint (not trigger)
-- It creates a log and references messages in a single transaction

CREATE OR REPLACE FUNCTION public.create_task_chat_log(
  p_task_id UUID,
  p_new_status task_status,
  p_created_by UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
  v_log_type chat_log_type;
  v_last_log_created_at TIMESTAMPTZ;
  v_task_created_at TIMESTAMPTZ;
  v_message_record RECORD;
  v_position INTEGER := 0;
  v_task_record RECORD;
BEGIN
  -- Task 조회 및 권한 검증
  SELECT * INTO v_task_record
  FROM public.tasks
  WHERE id = p_task_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found: %', p_task_id;
  END IF;

  -- 승인됨(APPROVED) 상태 이후에는 로그 생성하지 않음
  IF v_task_record.task_status = 'APPROVED' THEN
    RAISE WARNING 'Cannot create chat log: Task is already APPROVED. Logs are not created after approval.';
    RETURN NULL;
  END IF;

  -- REJECTED → IN_PROGRESS 전환 시 로그 생성하지 않음 (재작업이므로 로그 불필요)
  IF v_task_record.task_status = 'REJECTED' AND p_new_status = 'IN_PROGRESS' THEN
    RETURN NULL;
  END IF;

  -- 권한 검증: assigner 또는 assignee만 가능
  IF v_task_record.assigner_id != p_created_by AND v_task_record.assignee_id != p_created_by THEN
    RAISE EXCEPTION 'Permission denied: Only assigner or assignee can create chat logs';
  END IF;

  -- 프로젝트 접근 권한 확인
  IF NOT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = v_task_record.project_id
    AND has_project_access(p_created_by, id)
  ) THEN
    RAISE EXCEPTION 'Permission denied: No access to project';
  END IF;

  -- REJECTED → IN_PROGRESS 전환 시 로그 생성하지 않음 (재작업이므로 로그 불필요)
  IF v_task_record.task_status = 'REJECTED' AND p_new_status = 'IN_PROGRESS' THEN
    RETURN NULL;
  END IF;

  -- 새 상태에 맞는 log_type 결정
  v_log_type := CASE p_new_status
    WHEN 'IN_PROGRESS' THEN 'START'::chat_log_type
    WHEN 'WAITING_CONFIRM' THEN 'REQUEST_CONFIRM'::chat_log_type
    WHEN 'APPROVED' THEN 'APPROVE'::chat_log_type
    WHEN 'REJECTED' THEN 'REJECT'::chat_log_type
    ELSE NULL
  END;

  -- log_type이 NULL이면 로그 생성하지 않음 (ASSIGNED 상태는 로그 없음)
  IF v_log_type IS NULL THEN
    RETURN NULL;
  END IF;

  -- 마지막 로그의 created_at 조회
  SELECT created_at INTO v_last_log_created_at
  FROM public.task_chat_logs
  WHERE task_id = p_task_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- Task 생성 시간 조회
  SELECT created_at INTO v_task_created_at
  FROM public.tasks
  WHERE id = p_task_id;

  -- 로그 생성
  INSERT INTO public.task_chat_logs (
    task_id,
    created_by,
    log_type,
    created_at
  ) VALUES (
    p_task_id,
    p_created_by,
    v_log_type,
    now()
  )
  RETURNING id INTO v_log_id;

  -- 메시지 범위 결정 및 참조 추가
  -- 범위: 마지막 로그 이후 ~ 현재 시점 직전까지
  -- 마지막 로그가 없으면: Task 생성 이후 ~ 현재 시점 직전까지
  FOR v_message_record IN
    SELECT id, created_at
    FROM public.messages
    WHERE task_id = p_task_id
      AND message_type IN ('USER', 'FILE')
      AND deleted_at IS NULL
      AND (
        -- 마지막 로그가 있으면: 마지막 로그 이후
        (v_last_log_created_at IS NOT NULL AND created_at > v_last_log_created_at)
        OR
        -- 마지막 로그가 없으면: Task 생성 이후
        (v_last_log_created_at IS NULL AND created_at > v_task_created_at)
      )
      AND created_at < now() -- 현재 시점 직전까지
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
    );
    
    v_position := v_position + 1;
  END LOOP;

  RETURN v_log_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to create task chat log: %', SQLERRM;
    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.create_task_chat_log(UUID, task_status, UUID) IS 'Creates a chat log when task status changes. References messages between last log and current time. Returns log ID or NULL if creation failed or not applicable.';
