-- Update Task and Messages RLS Policies
-- 변경 사항:
-- 1. Task SELECT: Admin 또는 지시자/담당자만 접근 가능 (프로젝트 참여자 전체가 아님)
-- 2. Messages SELECT: Task SELECT와 일치하도록 수정
-- 3. Messages INSERT: 지시자 또는 담당자만 메시지 작성 가능

-- ----------------------------------------------------------------------------
-- 1. tasks 테이블 SELECT 정책 수정
-- ----------------------------------------------------------------------------

-- 기존 정책 삭제
DROP POLICY IF EXISTS "tasks_select_participant_or_admin" ON public.tasks;
DROP POLICY IF EXISTS "tasks_select_project_access" ON public.tasks;

-- 새로운 정책: Admin 또는 지시자/담당자만 task 접근 가능
CREATE POLICY "tasks_select_assigner_assignee_or_admin"
ON public.tasks
FOR SELECT
USING (
  -- Admin은 모든 task 접근 가능
  is_admin((SELECT auth.uid()))
  -- Member는 지시자 또는 담당자인 task만 접근 가능
  OR (SELECT auth.uid()) = assigner_id
  OR (SELECT auth.uid()) = assignee_id
);

COMMENT ON POLICY "tasks_select_assigner_assignee_or_admin" ON public.tasks IS 
'Task 조회 정책: Admin 또는 지시자/담당자만 task 접근 가능. Member는 자신이 지시자 또는 담당자인 task만 접근 가능.';

-- ----------------------------------------------------------------------------
-- 2. messages 테이블 SELECT 정책 수정
-- ----------------------------------------------------------------------------

-- 기존 정책 삭제
DROP POLICY IF EXISTS "messages_select_task_access" ON public.messages;

-- 새로운 정책: Admin 또는 지시자/담당자만 메시지 조회 가능 (Task SELECT와 일치)
CREATE POLICY "messages_select_assigner_assignee_or_admin"
ON public.messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = messages.task_id
    AND (
      -- Admin은 모든 task의 메시지 조회 가능
      is_admin((SELECT auth.uid()))
      -- Member는 지시자 또는 담당자인 task의 메시지만 조회 가능
      OR tasks.assigner_id = (SELECT auth.uid())
      OR tasks.assignee_id = (SELECT auth.uid())
    )
  )
);

COMMENT ON POLICY "messages_select_assigner_assignee_or_admin" ON public.messages IS 
'메시지 조회 정책: Admin 또는 지시자/담당자만 메시지 조회 가능. Task SELECT 정책과 일치.';

-- ----------------------------------------------------------------------------
-- 3. messages 테이블 INSERT 정책 수정
-- ----------------------------------------------------------------------------

-- 기존 정책 삭제
DROP POLICY IF EXISTS "messages_insert_task_access" ON public.messages;

-- 새로운 정책: 지시자 또는 담당자만 메시지 작성 가능
CREATE POLICY "messages_insert_assigner_or_assignee_only"
ON public.messages
FOR INSERT
WITH CHECK (
  -- Task가 존재하는지 확인
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = messages.task_id
  )
  -- 지시자 또는 담당자만 작성 가능 (Admin도 지시자/담당자가 아니면 불가)
  AND EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = messages.task_id
    AND (tasks.assigner_id = auth.uid() OR tasks.assignee_id = auth.uid())
  )
  -- 본인 메시지만 생성 가능
  AND auth.uid() = user_id
);

COMMENT ON POLICY "messages_insert_assigner_or_assignee_only" ON public.messages IS 
'메시지 작성 정책: 지시자 또는 담당자만 메시지 작성 가능. Admin도 지시자/담당자가 아니면 작성 불가.';


