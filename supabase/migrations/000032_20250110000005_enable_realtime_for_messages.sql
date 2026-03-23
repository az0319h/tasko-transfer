-- Enable Realtime for messages table
-- This allows real-time subscriptions to message changes (INSERT, UPDATE, DELETE)

-- Add messages table to supabase_realtime publication
-- This enables real-time subscriptions for INSERT, UPDATE, DELETE events
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Add comment for documentation
COMMENT ON PUBLICATION supabase_realtime IS 'Supabase Realtime publication - includes messages table for real-time chat functionality';


