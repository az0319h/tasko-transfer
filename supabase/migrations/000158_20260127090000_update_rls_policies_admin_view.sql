-- Update RLS policies to allow admin to view other users' schedules
-- 관리자가 다른 사용자의 일정을 조회할 수 있도록 정책 수정

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "task_schedules_select_assigner_assignee" ON public.task_schedules;

-- Create new SELECT policy: Assignee can view their own schedules, admin can view all schedules
CREATE POLICY "task_schedules_select_assigner_assignee"
ON public.task_schedules
FOR SELECT
USING (
  -- Admin은 모든 일정 조회 가능
  is_admin(auth.uid())
  -- 또는 담당자(assignee)는 자신의 일정 조회 가능
  OR EXISTS (
    SELECT 1 FROM public.tasks
    WHERE public.tasks.id = public.task_schedules.task_id
    AND public.tasks.assignee_id = auth.uid()
  )
);

-- Update comment
COMMENT ON POLICY "task_schedules_select_assigner_assignee" ON public.task_schedules IS 'Allow assignee to view their own schedules, and admin to view all schedules';
