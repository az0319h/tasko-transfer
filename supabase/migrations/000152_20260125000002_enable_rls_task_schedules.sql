-- Enable Row Level Security (RLS) on task_schedules table

ALTER TABLE public.task_schedules ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.task_schedules IS 'RLS enabled: Only assigner or assignee can view/modify schedules';
