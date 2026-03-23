-- RLS Policies for tasks table
-- Policy: Tasks are visible if user has access to parent project
-- Policy: Task modification is only allowed by assigner or assignee (Admin CANNOT modify)

-- Helper function: Check if user has access to project
CREATE OR REPLACE FUNCTION public.has_project_access(user_id UUID, project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = has_project_access.project_id
    AND (
      projects.is_public = true
      OR is_admin(user_id)
      OR has_task_in_project(user_id, projects.id)
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policy: SELECT - Users can see tasks if they have access to the parent project
CREATE POLICY "tasks_select_project_access"
ON public.tasks
FOR SELECT
USING (has_project_access(auth.uid(), project_id));

-- Policy: INSERT - Only authenticated users can create tasks (Admin only in practice)
CREATE POLICY "tasks_insert_authenticated"
ON public.tasks
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: UPDATE - Only assigner or assignee can update tasks (Admin CANNOT update)
CREATE POLICY "tasks_update_assigner_or_assignee_only"
ON public.tasks
FOR UPDATE
USING (
  auth.uid() = assigner_id OR auth.uid() = assignee_id
)
WITH CHECK (
  auth.uid() = assigner_id OR auth.uid() = assignee_id
);

-- Policy: DELETE - Only Admin can delete tasks
CREATE POLICY "tasks_delete_admin_only"
ON public.tasks
FOR DELETE
USING (is_admin(auth.uid()));

-- Add comments
COMMENT ON FUNCTION public.has_project_access(UUID, UUID) IS 'Helper function to check if a user has access to a project';

