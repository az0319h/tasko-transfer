-- Create new task_chat_logs system
-- This migration creates the new chat log system with explicit message references

-- 1. Create log_type enum for chat log types
CREATE TYPE chat_log_type AS ENUM (
  'START',           -- ASSIGNED -> IN_PROGRESS (시작)
  'REQUEST_CONFIRM', -- IN_PROGRESS -> WAITING_CONFIRM (확인 요청)
  'APPROVE',         -- WAITING_CONFIRM -> APPROVED (승인)
  'REJECT'           -- WAITING_CONFIRM -> REJECTED (거부)
);

COMMENT ON TYPE chat_log_type IS 'Chat log types: START (시작), REQUEST_CONFIRM (확인 요청), APPROVE (승인), REJECT (거부)';

-- 2. Create task_chat_logs table
CREATE TABLE public.task_chat_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  log_type chat_log_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create task_chat_log_items table (explicit message references)
CREATE TABLE public.task_chat_log_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id UUID NOT NULL REFERENCES public.task_chat_logs(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  position INTEGER NOT NULL, -- 순서 보장 (0부터 시작)
  UNIQUE(log_id, message_id) -- 같은 메시지가 같은 로그에 중복 참조되지 않도록
);

-- 4. Create indexes
CREATE INDEX idx_task_chat_logs_task_id ON public.task_chat_logs(task_id);
CREATE INDEX idx_task_chat_logs_created_at ON public.task_chat_logs(created_at DESC);
CREATE INDEX idx_task_chat_logs_task_created ON public.task_chat_logs(task_id, created_at DESC);
CREATE INDEX idx_task_chat_log_items_log_id ON public.task_chat_log_items(log_id);
CREATE INDEX idx_task_chat_log_items_message_id ON public.task_chat_log_items(message_id);
CREATE INDEX idx_task_chat_log_items_log_position ON public.task_chat_log_items(log_id, position ASC);

-- 5. Enable RLS
ALTER TABLE public.task_chat_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_chat_log_items ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policy: SELECT - Task 참여자만 조회 가능
CREATE POLICY "task_chat_logs_select_task_participants"
ON public.task_chat_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = task_chat_logs.task_id
    AND has_project_access(auth.uid(), tasks.project_id)
  )
);

CREATE POLICY "task_chat_log_items_select_task_participants"
ON public.task_chat_log_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.task_chat_logs
    JOIN public.tasks ON tasks.id = task_chat_logs.task_id
    WHERE task_chat_log_items.log_id = task_chat_logs.id
    AND has_project_access(auth.uid(), tasks.project_id)
  )
);

-- 7. RLS Policy: INSERT - 상태 변경 권한자만 가능 (assigner/assignee)
-- SECURITY DEFINER 함수를 통해 INSERT하므로, 함수 내부에서 권한 검증
CREATE POLICY "task_chat_logs_insert_status_changer"
ON public.task_chat_logs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = task_chat_logs.task_id
    AND (
      tasks.assigner_id = auth.uid()
      OR tasks.assignee_id = auth.uid()
    )
    AND has_project_access(auth.uid(), tasks.project_id)
  )
);

CREATE POLICY "task_chat_log_items_insert_status_changer"
ON public.task_chat_log_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.task_chat_logs
    JOIN public.tasks ON tasks.id = task_chat_logs.task_id
    WHERE task_chat_log_items.log_id = task_chat_logs.id
    AND (
      tasks.assigner_id = auth.uid()
      OR tasks.assignee_id = auth.uid()
    )
    AND has_project_access(auth.uid(), tasks.project_id)
  )
);

-- 8. RLS Policy: UPDATE/DELETE - 차단 (로그는 생성 후 수정/삭제 불가)
CREATE POLICY "task_chat_logs_no_update"
ON public.task_chat_logs
FOR UPDATE
USING (false)
WITH CHECK (false);

CREATE POLICY "task_chat_logs_no_delete"
ON public.task_chat_logs
FOR DELETE
USING (false);

CREATE POLICY "task_chat_log_items_no_update"
ON public.task_chat_log_items
FOR UPDATE
USING (false)
WITH CHECK (false);

CREATE POLICY "task_chat_log_items_no_delete"
ON public.task_chat_log_items
FOR DELETE
USING (false);

-- 9. Add comments
COMMENT ON TABLE public.task_chat_logs IS 'Chat logs created when task status changes. Each log represents a group of messages between status changes.';
COMMENT ON COLUMN public.task_chat_logs.log_type IS 'Type of status change: START (시작), REQUEST_CONFIRM (확인 요청), APPROVE (승인), REJECT (거부)';
COMMENT ON COLUMN public.task_chat_logs.created_by IS 'User who triggered the status change (assigner or assignee)';

COMMENT ON TABLE public.task_chat_log_items IS 'Explicit references to messages that belong to each chat log. Messages are referenced by ID with position for ordering.';
COMMENT ON COLUMN public.task_chat_log_items.position IS 'Order of message within the log (0-based index)';
