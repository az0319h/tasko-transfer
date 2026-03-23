-- Update RLS policies to allow only assignee (담당자) to view and update schedules
-- 기존 정책을 담당자(assignee)만 조회/수정 가능하도록 변경

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "task_schedules_select_assigner_assignee" ON public.task_schedules;

-- Create new SELECT policy: Only assignee can view schedules
CREATE POLICY "task_schedules_select_assigner_assignee"
ON public.task_schedules
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE public.tasks.id = public.task_schedules.task_id
    AND public.tasks.assignee_id = auth.uid()
  )
);

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "task_schedules_update_assigner_assignee" ON public.task_schedules;

-- Create new UPDATE policy: Only assignee can update schedules (for drag & drop, resize)
CREATE POLICY "task_schedules_update_assigner_assignee"
ON public.task_schedules
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE public.tasks.id = public.task_schedules.task_id
    AND public.tasks.assignee_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE public.tasks.id = public.task_schedules.task_id
    AND public.tasks.assignee_id = auth.uid()
  )
);

-- Update comments
COMMENT ON POLICY "task_schedules_select_assigner_assignee" ON public.task_schedules IS 'Allow only assignee to view schedules';
COMMENT ON POLICY "task_schedules_update_assigner_assignee" ON public.task_schedules IS 'Allow only assignee to update schedules (for drag & drop, resize)';
