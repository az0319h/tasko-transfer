-- Create messages table
-- Stores chat messages for tasks, supports both USER and SYSTEM message types
-- SYSTEM messages are automatically generated for task status changes

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  content TEXT NOT NULL,
  message_type message_type NOT NULL DEFAULT 'USER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX idx_messages_task_id ON public.messages(task_id);
CREATE INDEX idx_messages_user_id ON public.messages(user_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);
-- Composite index for common query: get messages by task ordered by time
CREATE INDEX idx_messages_task_created ON public.messages(task_id, created_at DESC);
-- Index for filtering SYSTEM messages
CREATE INDEX idx_messages_message_type ON public.messages(message_type);

-- Add constraint: SYSTEM messages must have specific format
-- Note: This is enforced at application level, but we can add a check constraint
ALTER TABLE public.messages
  ADD CONSTRAINT messages_content_not_empty
  CHECK (length(trim(content)) > 0);

-- Add comments for documentation
COMMENT ON TABLE public.messages IS 'Messages table: stores chat messages for tasks, supports USER and SYSTEM types';
COMMENT ON COLUMN public.messages.message_type IS 'Message type: USER (user messages) or SYSTEM (automated system messages for status changes)';
COMMENT ON COLUMN public.messages.user_id IS 'User who sent the message (for SYSTEM messages, this is the user who triggered the status change)';

