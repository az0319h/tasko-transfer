-- Update Task UPDATE RLS Policy to Admin only
-- New rules:
-- - Only Admin can update tasks
-- - assigner / assignee cannot update tasks
-- - Allowed fields: title, description, due_date only
-- - assigner_id, assignee_id, task_status cannot be changed (enforced at application level)

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "tasks_update_assigner_or_assignee_only" ON public.tasks;

-- Create new UPDATE policy: Admin only
CREATE POLICY "tasks_update_admin_only"
ON public.tasks
FOR UPDATE
USING (
  is_admin(auth.uid())
)
WITH CHECK (
  -- WITH CHECK ensures that after update, the user still has permission
  is_admin(auth.uid())
);

-- Add comment
COMMENT ON POLICY "tasks_update_admin_only" ON public.tasks IS
'Task UPDATE 정책: Admin만 Task 수정 가능. assigner_id, assignee_id, task_status 필드는 애플리케이션 레벨에서 변경 불가.';

