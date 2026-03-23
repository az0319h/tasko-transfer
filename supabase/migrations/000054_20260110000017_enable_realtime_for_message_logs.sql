-- Enable Realtime for message_logs table
-- This allows real-time subscriptions to message log changes (INSERT, UPDATE)

-- Add message_logs table to supabase_realtime publication
-- This enables real-time subscriptions for INSERT, UPDATE events
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_logs;

-- Add comment for documentation
COMMENT ON PUBLICATION supabase_realtime IS 'Supabase Realtime publication - includes messages and message_logs tables for real-time chat functionality';
