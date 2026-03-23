-- Update Task INSERT RLS Policy
-- 변경된 요구사항: 
-- - Public 프로젝트: 모든 로그인 사용자(Admin + Member)가 Task 생성 가능
-- - Private 프로젝트: 해당 프로젝트에 접근 권한이 있는 사용자만 Task 생성 가능
-- - Task 생성자는 무조건 assigner로 지정 (auth.uid() = assigner_id)

-- 기존 정책 삭제
DROP POLICY IF EXISTS "tasks_insert_authenticated" ON public.tasks;

-- 새로운 INSERT 정책 생성
-- Public 프로젝트: 모든 로그인 사용자 가능
-- Private 프로젝트: 프로젝트 접근 권한이 있는 사용자만 가능
-- Task 생성자는 무조건 assigner로 지정되어야 함
CREATE POLICY "tasks_insert_project_access"
ON public.tasks
FOR INSERT
WITH CHECK (
  -- 로그인한 사용자여야 함
  auth.uid() IS NOT NULL
  -- 프로젝트 접근 권한이 있어야 함
  AND has_project_access(auth.uid(), project_id)
  -- 생성자는 무조건 assigner로 지정되어야 함
  AND auth.uid() = assigner_id
);

-- Add comment
COMMENT ON POLICY "tasks_insert_project_access" ON public.tasks IS 
'Task 생성 정책: Public 프로젝트는 모든 로그인 사용자, Private 프로젝트는 접근 권한이 있는 사용자만 생성 가능. 생성자는 무조건 assigner로 지정됨.';

