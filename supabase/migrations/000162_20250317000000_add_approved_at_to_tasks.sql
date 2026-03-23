-- Add approved_at column to tasks for dashboard metrics accuracy
-- approved_at records the moment a task was first approved (immutable)
-- Using updated_at for approval metrics causes drift when approved tasks are later edited

-- 1. Add column
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

COMMENT ON COLUMN public.tasks.approved_at IS 'Timestamp when task was first approved. Set only when task_status changes to APPROVED.';

-- 2. Trigger: set approved_at when task_status changes to APPROVED
CREATE OR REPLACE FUNCTION public.set_approved_at_on_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.task_status IS DISTINCT FROM NEW.task_status
     AND NEW.task_status = 'APPROVED' THEN
    NEW.approved_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_approved_at_on_approval ON public.tasks;
CREATE TRIGGER trigger_set_approved_at_on_approval
  BEFORE UPDATE OF task_status ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_approved_at_on_approval();

-- 3. Backfill: set approved_at = updated_at for existing APPROVED tasks
-- (best-effort for historical data; new approvals will have accurate approved_at)
UPDATE public.tasks
SET approved_at = updated_at
WHERE task_status = 'APPROVED' AND approved_at IS NULL;

-- 4. Index for dashboard metrics queries filtering by approved_at
CREATE INDEX IF NOT EXISTS idx_tasks_approved_at
  ON public.tasks (approved_at)
  WHERE approved_at IS NOT NULL;
