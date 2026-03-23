-- Create RLS policies for task_schedules table

-- SELECT policy: Only assignee can view schedules (담당자만 일정 조회 가능)
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

-- INSERT policy: Only trigger can create schedules (users cannot manually create)
CREATE POLICY "task_schedules_insert_trigger_only"
ON public.task_schedules
FOR INSERT
WITH CHECK (false); -- Users cannot manually insert, only trigger can create

-- UPDATE policy: Only assignee can update schedules (담당자만 일정 수정 가능 - 드래그/리사이즈)
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

-- DELETE policy: Only assigner can delete schedules
CREATE POLICY "task_schedules_delete_assigner"
ON public.task_schedules
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE public.tasks.id = public.task_schedules.task_id
    AND public.tasks.assigner_id = auth.uid()
  )
);

-- Add comments
COMMENT ON POLICY "task_schedules_select_assigner_assignee" ON public.task_schedules IS 'Allow only assignee to view schedules';
COMMENT ON POLICY "task_schedules_insert_trigger_only" ON public.task_schedules IS 'Prevent manual schedule creation (only trigger can create)';
COMMENT ON POLICY "task_schedules_update_assigner_assignee" ON public.task_schedules IS 'Allow only assignee to update schedules (for drag & drop, resize)';
COMMENT ON POLICY "task_schedules_delete_assigner" ON public.task_schedules IS 'Allow only assigner to delete schedules';
