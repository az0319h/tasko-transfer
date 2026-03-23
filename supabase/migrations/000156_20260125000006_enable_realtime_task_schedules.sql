-- Enable Realtime for task_schedules table
-- This allows real-time updates when schedules are modified

ALTER PUBLICATION supabase_realtime ADD TABLE public.task_schedules;

COMMENT ON TABLE public.task_schedules IS 'Realtime enabled: Changes to schedules are broadcasted in real-time';
