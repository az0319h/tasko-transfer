-- Create tasks table
-- Tasks inherit access permissions from their parent project
-- Tasks do NOT have is_public field - they inherit from projects

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assigner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  assignee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  task_status task_status NOT NULL DEFAULT 'ASSIGNED',
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX idx_tasks_assigner_id ON public.tasks(assigner_id);
CREATE INDEX idx_tasks_assignee_id ON public.tasks(assignee_id);
CREATE INDEX idx_tasks_task_status ON public.tasks(task_status);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);
-- Composite index for common query: get tasks by project and status
CREATE INDEX idx_tasks_project_status ON public.tasks(project_id, task_status);

-- Add updated_at trigger to tasks table
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add constraint: assigner and assignee must be different
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_assigner_assignee_different
  CHECK (assigner_id != assignee_id);

-- Add comments for documentation
COMMENT ON TABLE public.tasks IS 'Tasks table: inherits access permissions from parent project';
COMMENT ON COLUMN public.tasks.task_status IS 'Task workflow status: ASSIGNED -> IN_PROGRESS -> WAITING_CONFIRM -> APPROVED/REJECTED';
COMMENT ON COLUMN public.tasks.assigner_id IS 'User who assigned the task (can approve/reject)';
COMMENT ON COLUMN public.tasks.assignee_id IS 'User assigned to complete the task (can mark as IN_PROGRESS)';

