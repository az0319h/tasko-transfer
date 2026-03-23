-- Create email_logs table
-- Stores email sending history for monitoring and debugging
-- Used by Edge Function to log email delivery attempts

CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

-- Create indexes for monitoring and debugging
CREATE INDEX idx_email_logs_task_id ON public.email_logs(task_id);
CREATE INDEX idx_email_logs_status ON public.email_logs(status);
CREATE INDEX idx_email_logs_created_at ON public.email_logs(created_at DESC);
CREATE INDEX idx_email_logs_recipient_email ON public.email_logs(recipient_email);

-- Add comments for documentation
COMMENT ON TABLE public.email_logs IS 'Email logs table: tracks email delivery attempts for task status change notifications';
COMMENT ON COLUMN public.email_logs.status IS 'Email status: pending (queued), sent (delivered), failed (delivery failed)';
COMMENT ON COLUMN public.email_logs.retry_count IS 'Number of retry attempts for failed emails (max 3)';

