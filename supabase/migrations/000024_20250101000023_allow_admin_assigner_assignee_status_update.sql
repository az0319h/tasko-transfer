-- Allow Admin to update task_status when Admin is assigner or assignee
-- This migration fixes the issue where Admin who is assigner cannot update task status
--
-- Problem:
-- - Current policy (tasks_update_status_assigner_assignee) excludes Admin with NOT is_admin()
-- - Admin who is assigner should be able to approve/reject tasks (WAITING_CONFIRM → APPROVED/REJECTED)
-- - Admin who is assignee should be able to change status (ASSIGNED → IN_PROGRESS, etc.)
--
-- Solution:
-- - Remove NOT is_admin() condition from tasks_update_status_assigner_assignee policy
-- - Allow Admin to update task_status if Admin is assigner or assignee
-- - This maintains security: only assigner/assignee can update status, regardless of Admin role

-- Step 1: Drop existing policy
DROP POLICY IF EXISTS "tasks_update_status_assigner_assignee" ON public.tasks;

-- Step 2: Create new policy without Admin exclusion
-- Assigner/assignee can update task_status (including Admin if Admin is assigner/assignee)
CREATE POLICY "tasks_update_status_assigner_assignee"
ON public.tasks
FOR UPDATE
USING (
  auth.uid() = assigner_id OR auth.uid() = assignee_id
)
WITH CHECK (
  auth.uid() = assigner_id OR auth.uid() = assignee_id
);

-- Update comment
COMMENT ON POLICY "tasks_update_status_assigner_assignee" ON public.tasks IS
'Task UPDATE 정책 (상태 변경용): assigner 또는 assignee만 task_status 필드 수정 가능. Admin이 assigner/assignee인 경우에도 상태 변경 가능. 다른 필드는 변경 불가 (애플리케이션 레벨에서 제어).';


