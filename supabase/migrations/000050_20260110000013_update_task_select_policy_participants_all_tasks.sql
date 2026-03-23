-- Update Task SELECT RLS Policy - 프로젝트 참여자 전원이 모든 Task 목록 조회 가능
-- 변경 사항:
-- 1. Task SELECT: 프로젝트 참여자 전원이 모든 Task 목록 조회 가능 (이전: assigner/assignee만)
-- 2. Messages SELECT: Task SELECT와 일치하도록 수정
-- 3. 상세 접근 권한은 애플리케이션 레벨에서 제어 (Admin: 모든 Task, Member: 자신의 Task만)

-- ----------------------------------------------------------------------------
-- 1. tasks 테이블 SELECT 정책 수정
-- ----------------------------------------------------------------------------

-- 기존 정책 삭제
DROP POLICY IF EXISTS "tasks_select_assigner_assignee_or_admin" ON public.tasks;
DROP POLICY IF EXISTS "tasks_select_participant_or_admin" ON public.tasks;

-- 새로운 정책: 프로젝트 참여자 전원이 모든 Task 조회 가능
-- 목록 조회: 프로젝트 참여자 전원 접근 가능
-- 상세 접근: 애플리케이션 레벨에서 제어 (Admin: 모든 Task, Member: 자신의 Task만)
CREATE POLICY "tasks_select_participant_or_admin"
ON public.tasks
FOR SELECT
USING (
  -- Admin은 모든 task 접근 가능
  is_admin((SELECT auth.uid()))
  -- 프로젝트 참여자 전원이 모든 task 접근 가능
  OR is_project_participant((SELECT auth.uid()), project_id)
);

COMMENT ON POLICY "tasks_select_participant_or_admin" ON public.tasks IS 
'Task 조회 정책: 프로젝트 참여자 전원이 모든 Task 목록 조회 가능. 상세 접근 권한은 애플리케이션 레벨에서 제어됨 (Admin: 모든 Task, Member: 자신의 Task만).';

-- ----------------------------------------------------------------------------
-- 2. messages 테이블 SELECT 정책 수정
-- ----------------------------------------------------------------------------

-- 기존 정책 삭제
DROP POLICY IF EXISTS "messages_select_assigner_assignee_or_admin" ON public.messages;

-- 새로운 정책: 프로젝트 참여자 전원이 메시지 조회 가능 (Task SELECT와 일치)
-- Task에 접근할 수 있으면 해당 Task의 메시지도 조회 가능
CREATE POLICY "messages_select_participant_or_admin"
ON public.messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = messages.task_id
    AND (
      -- Admin은 모든 task의 메시지 조회 가능
      is_admin((SELECT auth.uid()))
      -- 프로젝트 참여자 전원이 모든 task의 메시지 조회 가능
      OR is_project_participant((SELECT auth.uid()), tasks.project_id)
    )
  )
);

COMMENT ON POLICY "messages_select_participant_or_admin" ON public.messages IS 
'메시지 조회 정책: 프로젝트 참여자 전원이 메시지 조회 가능. Task SELECT 정책과 일치.';

-- ----------------------------------------------------------------------------
-- 3. messages 테이블 INSERT 정책 유지
-- ----------------------------------------------------------------------------

-- 기존 INSERT 정책은 그대로 유지 (지시자 또는 담당자만 메시지 작성 가능)
-- messages_insert_assigner_or_assignee_only 정책이 이미 올바르게 설정되어 있음

