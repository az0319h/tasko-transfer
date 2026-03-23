-- Update Task INSERT RLS Policy - Admin Only
-- 변경된 요구사항: 
-- - Task 생성은 Admin만 가능
-- - assigner_id와 assignee_id는 모두 선택값 (자동 설정되지 않음)
-- - assigner와 assignee는 모두 해당 프로젝트에 속한 사용자여야 함

-- Helper function: Check if user is a member of a project
-- 프로젝트 멤버십 확인: 프로젝트 생성자이거나 해당 프로젝트에 Task가 있는 사용자
CREATE OR REPLACE FUNCTION public.is_project_member(user_id UUID, project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = is_project_member.project_id
    AND (
      -- 프로젝트 생성자
      projects.created_by = user_id
      -- 또는 해당 프로젝트에 Task가 있는 사용자 (assigner 또는 assignee)
      OR EXISTS (
        SELECT 1 FROM public.tasks
        WHERE tasks.project_id = is_project_member.project_id
        AND (tasks.assigner_id = user_id OR tasks.assignee_id = user_id)
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 기존 정책 삭제
DROP POLICY IF EXISTS "tasks_insert_authenticated" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert_project_access" ON public.tasks;

-- 새로운 INSERT 정책 생성
-- 1. Admin만 Task 생성 가능
-- 2. assigner와 assignee는 모두 해당 프로젝트에 속한 사용자여야 함
CREATE POLICY "tasks_insert_admin_only"
ON public.tasks
FOR INSERT
WITH CHECK (
  -- Admin만 가능
  is_admin(auth.uid())
  -- assigner는 해당 프로젝트에 속한 사용자여야 함
  AND is_project_member(assigner_id, project_id)
  -- assignee는 해당 프로젝트에 속한 사용자여야 함
  AND is_project_member(assignee_id, project_id)
  -- assigner와 assignee는 달라야 함
  AND assigner_id != assignee_id
);

-- Add comments
COMMENT ON FUNCTION public.is_project_member(UUID, UUID) IS 
'프로젝트 멤버십 확인 함수: 사용자가 프로젝트 생성자이거나 해당 프로젝트에 Task가 있는 사용자인지 확인';

COMMENT ON POLICY "tasks_insert_admin_only" ON public.tasks IS 
'Task 생성 정책: Admin만 Task 생성 가능. assigner와 assignee는 모두 해당 프로젝트에 속한 사용자여야 함.';

