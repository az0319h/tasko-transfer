-- RLS Policies for email_logs table
-- Policy: Users can view email logs if they have access to the parent task
-- Policy: Email logs are read-only (only Edge Function can insert)

-- Policy: SELECT - Users can see email logs if they have access to the parent task
CREATE POLICY "email_logs_select_task_access"
ON public.email_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = email_logs.task_id
    AND has_project_access(auth.uid(), tasks.project_id)
  )
);

-- Policy: INSERT - Only service role can insert (Edge Function uses service role)
-- Note: This is handled by Edge Function using service role key, so we don't need a policy here
-- But we can add a policy that allows authenticated users for debugging purposes
-- In production, Edge Function should use service role key which bypasses RLS

-- Add comment
COMMENT ON TABLE public.email_logs IS 'Email logs are read-only for users, insert is done by Edge Function with service role';

