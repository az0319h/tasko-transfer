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
