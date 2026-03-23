-- Update Task INSERT RLS Policy - 프로젝트 참여자도 Task 생성 가능
-- 변경된 요구사항: 
-- - Task 생성은 Admin 또는 프로젝트 참여자 모두 가능
-- - assigner_id는 자동으로 현재 로그인한 사용자로 설정됨 (auth.uid())
-- - assignee는 해당 프로젝트에 속한 사용자여야 함

-- Helper function: Check if user is a participant of a project
-- 프로젝트 참여자 확인: project_participants 테이블에서 확인
CREATE OR REPLACE FUNCTION public.is_project_participant(user_id UUID, project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.project_participants
    WHERE project_participants.project_id = is_project_participant.project_id
    AND project_participants.user_id = is_project_participant.user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Check if user is a member of a project
-- 프로젝트 멤버십 확인: 프로젝트 생성자이거나 프로젝트 참여자
CREATE OR REPLACE FUNCTION public.is_project_member(user_id UUID, project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = is_project_member.project_id
    AND (
      -- 프로젝트 생성자
      projects.created_by = user_id
      -- 또는 프로젝트 참여자
      OR is_project_participant(user_id, project_id)
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 기존 정책 삭제
DROP POLICY IF EXISTS "tasks_insert_admin_only" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert_project_access" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert_authenticated" ON public.tasks;

-- 새로운 INSERT 정책 생성
-- 1. Admin 또는 프로젝트 참여자만 Task 생성 가능
-- 2. assigner_id는 자동으로 현재 로그인한 사용자로 설정됨 (auth.uid() = assigner_id)
-- 3. assignee는 해당 프로젝트에 속한 사용자여야 함
CREATE POLICY "tasks_insert_admin_or_participant"
ON public.tasks
FOR INSERT
WITH CHECK (
  -- Admin 또는 프로젝트 참여자만 가능
  (
    is_admin(auth.uid())
    OR is_project_participant(auth.uid(), project_id)
  )
  -- assigner_id는 자동으로 현재 로그인한 사용자로 설정됨
  AND auth.uid() = assigner_id
  -- assignee는 해당 프로젝트에 속한 사용자여야 함
  AND is_project_member(assignee_id, project_id)
  -- assigner와 assignee는 달라야 함
  AND assigner_id != assignee_id
);

-- Add comments
COMMENT ON FUNCTION public.is_project_participant(UUID, UUID) IS 
'프로젝트 참여자 확인 함수: 사용자가 project_participants 테이블에 등록된 프로젝트 참여자인지 확인';

COMMENT ON FUNCTION public.is_project_member(UUID, UUID) IS 
'프로젝트 멤버십 확인 함수: 사용자가 프로젝트 생성자이거나 프로젝트 참여자인지 확인';

COMMENT ON POLICY "tasks_insert_admin_or_participant" ON public.tasks IS 
'Task 생성 정책: Admin 또는 프로젝트 참여자만 Task 생성 가능. assigner_id는 자동으로 현재 로그인한 사용자로 설정됨. assignee는 해당 프로젝트에 속한 사용자여야 함.';


