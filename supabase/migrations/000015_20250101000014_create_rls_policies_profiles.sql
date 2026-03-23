-- RLS Policies for profiles table
-- Policy: Users can view profiles of users in the same project
-- This allows Task assigner/assignee information to be displayed for all users

-- Helper function: Check if current user can access a profile
-- 현재 사용자가 특정 프로필에 접근할 수 있는지 확인
-- 조건: 동일 프로젝트에 속한 Task의 assigner 또는 assignee인 경우
CREATE OR REPLACE FUNCTION public.can_access_profile(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    -- 현재 사용자가 접근할 수 있는 프로젝트에 속한 Task에서
    -- target_user_id가 assigner 또는 assignee로 참여한 경우
    SELECT 1 FROM public.tasks
    WHERE (tasks.assigner_id = target_user_id OR tasks.assignee_id = target_user_id)
    AND has_project_access(auth.uid(), tasks.project_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policy: Users can view profiles of users who share a project with them
-- 동일 프로젝트에 속한 사용자의 프로필 조회 가능
-- 기존 정책("Users can view own profile", "Admins can view all profiles")과 함께 작동
CREATE POLICY "profiles_select_same_project"
ON public.profiles
FOR SELECT
USING (
  -- 동일 프로젝트에 속한 사용자의 프로필 조회 가능
  can_access_profile(id)
);

-- Add comment
COMMENT ON FUNCTION public.are_users_in_same_project(UUID, UUID) IS 
'두 사용자가 동일한 프로젝트에 속해 있는지 확인하는 함수 (Task를 통해 연결된 경우)';

COMMENT ON POLICY "profiles_select_same_project" ON public.profiles IS 
'동일 프로젝트에 속한 사용자의 프로필 조회 정책: Task의 assigner/assignee 정보 표시를 위해 필요';

