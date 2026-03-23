-- RLS Policies for projects table
-- Policy: Public projects are visible to all authenticated users
-- Policy: Private projects are visible to Admin OR users who have tasks in that project

-- Helper function: Check if user is Admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Check if user has tasks in a project
CREATE OR REPLACE FUNCTION public.has_task_in_project(user_id UUID, project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.tasks
    WHERE (assigner_id = user_id OR assignee_id = user_id)
    AND tasks.project_id = has_task_in_project.project_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policy: SELECT - Public projects visible to all, Private projects visible to Admin or task participants
CREATE POLICY "projects_select_public_or_authorized"
ON public.projects
FOR SELECT
USING (
  is_public = true
  OR is_admin(auth.uid())
  OR has_task_in_project(auth.uid(), id)
);

-- Policy: INSERT - Only authenticated users can create projects (Admin only in practice)
CREATE POLICY "projects_insert_authenticated"
ON public.projects
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: UPDATE - Only Admin can update projects
CREATE POLICY "projects_update_admin_only"
ON public.projects
FOR UPDATE
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Policy: DELETE - Only Admin can delete projects
CREATE POLICY "projects_delete_admin_only"
ON public.projects
FOR DELETE
USING (is_admin(auth.uid()));

-- Add comments
COMMENT ON FUNCTION public.is_admin(UUID) IS 'Helper function to check if a user is an Admin';
COMMENT ON FUNCTION public.has_task_in_project(UUID, UUID) IS 'Helper function to check if a user has tasks in a specific project';

