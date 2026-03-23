-- Enable Row Level Security (RLS) on all tables
-- RLS policies will be defined in separate migration files

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Add comments
COMMENT ON TABLE public.projects IS 'RLS enabled: Access controlled by project visibility and user role';
COMMENT ON TABLE public.tasks IS 'RLS enabled: Access controlled by parent project permissions';
COMMENT ON TABLE public.messages IS 'RLS enabled: Access controlled by task permissions';
COMMENT ON TABLE public.email_logs IS 'RLS enabled: Access controlled by task permissions (read-only for debugging)';

