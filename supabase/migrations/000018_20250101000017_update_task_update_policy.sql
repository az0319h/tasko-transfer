-- Update Task UPDATE RLS Policy
-- New rules:
-- - assigner: can update
-- - assignee: can update
-- - Admin: can update ONLY if Admin is the assigner of the task
-- - assigner_id and assignee_id fields cannot be changed (enforced at application level)

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "tasks_update_assigner_or_assignee_only" ON public.tasks;

-- Create new UPDATE policy
-- Note: Admin who is assigner will pass auth.uid() = assigner_id check
-- The policy allows: assigner OR assignee (which includes Admin if Admin is assigner)
CREATE POLICY "tasks_update_assigner_or_assignee_only"
ON public.tasks
FOR UPDATE
USING (
  auth.uid() = assigner_id OR auth.uid() = assignee_id
)
WITH CHECK (
  -- WITH CHECK ensures that after update, the user still has permission
  -- Since assigner_id and assignee_id cannot be changed (enforced at app level),
  -- we check the same conditions
  auth.uid() = assigner_id OR auth.uid() = assignee_id
);

-- Add comment
COMMENT ON POLICY "tasks_update_assigner_or_assignee_only" ON public.tasks IS
'Task UPDATE 정책: assigner 또는 assignee만 수정 가능. Admin이 assigner인 경우에도 수정 가능 (auth.uid() = assigner_id 조건에 포함됨). assigner_id와 assignee_id 필드는 애플리케이션 레벨에서 변경 불가.';

