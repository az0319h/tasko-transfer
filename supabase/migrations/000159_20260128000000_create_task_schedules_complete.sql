-- ============================================================================
-- Task Schedules Complete Migration
-- 일정 관리 기능 전체 마이그레이션
-- ============================================================================
-- 이 마이그레이션은 task_schedules 테이블과 관련된 모든 기능을 한 번에 적용합니다.
-- 순서: 테이블 생성 → RLS 활성화 → 정책 생성 → 트리거 생성 → Realtime 활성화
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Create task_schedules table
-- ----------------------------------------------------------------------------
-- Create task_schedules table for calendar schedule management
-- This table stores schedule information for tasks, independent from task due_date

CREATE TABLE IF NOT EXISTS public.task_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_all_day BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT task_schedules_time_check CHECK (end_time > start_time),
  CONSTRAINT task_schedules_unique_task UNIQUE (task_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_task_schedules_start_time ON public.task_schedules(start_time);
CREATE INDEX IF NOT EXISTS idx_task_schedules_date_range ON public.task_schedules(start_time, end_time);

-- Add comments
COMMENT ON TABLE public.task_schedules IS 'Task schedule information for calendar display. Independent from task due_date.';
COMMENT ON COLUMN public.task_schedules.task_id IS 'Reference to tasks table';
COMMENT ON COLUMN public.task_schedules.start_time IS 'Schedule start time (TIMESTAMPTZ for FullCalendar compatibility)';
COMMENT ON COLUMN public.task_schedules.end_time IS 'Schedule end time (TIMESTAMPTZ for FullCalendar compatibility)';
COMMENT ON COLUMN public.task_schedules.is_all_day IS 'Whether this is an all-day event (FullCalendar allDay prop compatibility)';

-- ----------------------------------------------------------------------------
-- 2. Enable Row Level Security (RLS)
-- ----------------------------------------------------------------------------
ALTER TABLE public.task_schedules ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.task_schedules IS 'RLS enabled: Only assignee can view/modify schedules, admin can view all schedules';

-- ----------------------------------------------------------------------------
-- 3. Create RLS policies
-- ----------------------------------------------------------------------------
-- SELECT policy: Assignee can view their own schedules, admin can view all schedules
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
COMMENT ON POLICY "task_schedules_select_assigner_assignee" ON public.task_schedules IS 'Allow assignee to view their own schedules, and admin to view all schedules';
COMMENT ON POLICY "task_schedules_insert_trigger_only" ON public.task_schedules IS 'Prevent manual schedule creation (only trigger can create)';
COMMENT ON POLICY "task_schedules_update_assigner_assignee" ON public.task_schedules IS 'Allow only assignee to update schedules (for drag & drop, resize)';
COMMENT ON POLICY "task_schedules_delete_assigner" ON public.task_schedules IS 'Allow only assigner to delete schedules';

-- ----------------------------------------------------------------------------
-- 4. Create trigger functions and triggers
-- ----------------------------------------------------------------------------

-- Trigger function: Automatically create schedule when task is created
-- Creates schedule for any assignee (담당자에게 자동으로 일정 생성)
CREATE OR REPLACE FUNCTION public.create_task_schedule()
RETURNS TRIGGER AS $$
BEGIN
  -- 담당자(assignee)가 있고 due_date가 있으면 일정 생성
  -- Task를 생성한 사용자가 누구인지와 관계없이 담당자에게 일정 생성
  IF NEW.assignee_id IS NOT NULL AND NEW.due_date IS NOT NULL THEN
    INSERT INTO public.task_schedules (task_id, start_time, end_time, is_all_day)
    VALUES (
      NEW.id,
      DATE_TRUNC('day', NEW.due_date)::TIMESTAMPTZ,
      (DATE_TRUNC('day', NEW.due_date) + INTERVAL '1 day' - INTERVAL '1 second')::TIMESTAMPTZ,
      true
    );
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Schedule creation failure should not fail task creation
    RAISE WARNING 'Failed to create task schedule: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function: Automatically delete schedule when task is approved
CREATE OR REPLACE FUNCTION public.delete_schedule_on_approved()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete schedule when task status changes to APPROVED
  IF NEW.task_status = 'APPROVED' AND (OLD.task_status IS NULL OR OLD.task_status != 'APPROVED') THEN
    DELETE FROM public.task_schedules WHERE task_id = NEW.id;
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Schedule deletion failure should not fail task update
    RAISE WARNING 'Failed to delete task schedule on approved: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers on tasks table
CREATE TRIGGER trigger_create_task_schedule
  AFTER INSERT ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.create_task_schedule();

CREATE TRIGGER trigger_delete_schedule_on_approved
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_schedule_on_approved();

-- Add comments
COMMENT ON FUNCTION public.create_task_schedule() IS 'Trigger function that creates schedule when task is created (for any assignee with due_date)';
COMMENT ON TRIGGER trigger_create_task_schedule ON public.tasks IS 'Automatically creates schedule when task is created with assignee and due_date';
COMMENT ON FUNCTION public.delete_schedule_on_approved() IS 'Trigger function that deletes schedule when task status changes to APPROVED';
COMMENT ON TRIGGER trigger_delete_schedule_on_approved ON public.tasks IS 'Automatically deletes schedule when task is approved';

-- ----------------------------------------------------------------------------
-- 5. Enable Realtime
-- ----------------------------------------------------------------------------
-- Enable Realtime for task_schedules table
-- This allows real-time updates when schedules are modified
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_schedules;

COMMENT ON TABLE public.task_schedules IS 'Realtime enabled: Changes to schedules are broadcasted in real-time. RLS enabled: Only assignee can view/modify schedules, admin can view all schedules';
