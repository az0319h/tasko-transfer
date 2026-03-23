-- Create message_logs table
-- Stores message grouping logs based on task status changes
-- Each log represents a group of messages between status changes

CREATE TABLE IF NOT EXISTS public.message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL, -- 예: "진행 중 이전 대화"
  status task_status NOT NULL, -- 새로 변경된 상태 (예: IN_PROGRESS)
  system_message_id UUID NOT NULL REFERENCES public.messages(id), -- 상태 변경 시 생성된 SYSTEM 메시지 ID
  previous_system_message_id UUID REFERENCES public.messages(id), -- 이전 SYSTEM 메시지 ID (첫 로그는 NULL)
  file_count INTEGER NOT NULL DEFAULT 0, -- FILE 메시지 개수
  text_count INTEGER NOT NULL DEFAULT 0, -- USER 메시지 개수
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), -- 로그 생성 시간 (SYSTEM 메시지의 created_at과 동일)
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_message_logs_task_id ON public.message_logs(task_id);
CREATE INDEX idx_message_logs_created_at ON public.message_logs(created_at DESC);
CREATE INDEX idx_message_logs_task_created ON public.message_logs(task_id, created_at DESC);
CREATE INDEX idx_message_logs_system_message_id ON public.message_logs(system_message_id);
CREATE INDEX idx_message_logs_previous_system_message_id ON public.message_logs(previous_system_message_id);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_message_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_message_logs_updated_at
  BEFORE UPDATE ON public.message_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_message_logs_updated_at();

-- RLS 활성화
ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY;

-- RLS 정책: SELECT - Task 접근 권한이 있으면 로그 조회 가능 (messages와 동일한 정책)
CREATE POLICY "message_logs_select_task_access"
ON public.message_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = message_logs.task_id
    AND has_project_access(auth.uid(), tasks.project_id)
  )
);

-- RLS 정책: INSERT - 트리거에서만 자동 생성 (사용자 직접 생성 불가)
-- SECURITY DEFINER 함수에서만 INSERT 가능하도록 제한
-- SECURITY DEFINER 함수는 함수 소유자 권한으로 실행되므로 RLS를 우회할 수 있음
CREATE POLICY "message_logs_insert_trigger_only"
ON public.message_logs
FOR INSERT
WITH CHECK (false); -- 사용자 직접 INSERT 불가, SECURITY DEFINER 트리거에서만 가능

-- RLS 정책: UPDATE - 트리거에서만 업데이트 (메시지 카운트 업데이트용)
-- SECURITY DEFINER 함수는 함수 소유자 권한으로 실행되므로 RLS를 우회할 수 있음
CREATE POLICY "message_logs_update_trigger_only"
ON public.message_logs
FOR UPDATE
USING (false) -- 사용자 직접 UPDATE 불가, SECURITY DEFINER 트리거에서만 가능
WITH CHECK (false);

-- RLS 정책: DELETE - CASCADE로 Task 삭제 시 자동 삭제 (사용자 직접 삭제 불가)
-- CASCADE DELETE는 RLS를 우회하므로 별도 정책 불필요하지만, 명시적으로 차단
CREATE POLICY "message_logs_delete_trigger_only"
ON public.message_logs
FOR DELETE
USING (false); -- 사용자 직접 DELETE 불가, CASCADE DELETE만 가능

-- Add comments
COMMENT ON TABLE public.message_logs IS 'Message grouping logs based on task status changes. Each log represents a group of messages between status changes.';
COMMENT ON COLUMN public.message_logs.title IS 'Log title format: "{새 상태} 이전 대화" (e.g., "진행 중 이전 대화")';
COMMENT ON COLUMN public.message_logs.status IS 'New task status after status change';
COMMENT ON COLUMN public.message_logs.system_message_id IS 'SYSTEM message ID created when status changed';
COMMENT ON COLUMN public.message_logs.previous_system_message_id IS 'Previous SYSTEM message ID (NULL for first log)';
COMMENT ON COLUMN public.message_logs.file_count IS 'Number of FILE type messages in this log';
COMMENT ON COLUMN public.message_logs.text_count IS 'Number of USER type messages in this log';
