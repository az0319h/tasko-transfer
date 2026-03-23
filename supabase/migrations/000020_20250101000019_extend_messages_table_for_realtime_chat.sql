-- Extend messages table for realtime chat features
-- Add read_by tracking, file support, and typing indicator support

-- 1. Extend message_type enum to include FILE
ALTER TYPE message_type ADD VALUE IF NOT EXISTS 'FILE';

-- 2. Add read_by column (JSONB array of user IDs who have read the message)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS read_by JSONB DEFAULT '[]'::jsonb;

-- 3. Add file-related columns for FILE message type
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS file_url TEXT,
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS file_type TEXT,
  ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- 4. Add index for read_by queries (GIN index for JSONB)
CREATE INDEX IF NOT EXISTS idx_messages_read_by ON public.messages USING GIN (read_by);

-- 5. Add function to mark message as read
CREATE OR REPLACE FUNCTION public.mark_message_as_read(
  message_id UUID,
  reader_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.messages
  SET read_by = COALESCE(read_by, '[]'::jsonb) || jsonb_build_array(reader_id::text)
  WHERE id = message_id
    AND NOT (read_by ? reader_id::text);
END;
$$;

-- 6. Add function to mark all messages in a task as read for a user
CREATE OR REPLACE FUNCTION public.mark_task_messages_as_read(
  task_id_param UUID,
  reader_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.messages
  SET read_by = COALESCE(read_by, '[]'::jsonb) || jsonb_build_array(reader_id::text)
  WHERE task_id = task_id_param
    AND NOT (read_by ? reader_id::text);
END;
$$;

-- 7. Add comments
COMMENT ON COLUMN public.messages.read_by IS 'JSONB array of user IDs who have read this message';
COMMENT ON COLUMN public.messages.file_url IS 'Storage URL for file messages (message_type = FILE)';
COMMENT ON COLUMN public.messages.file_name IS 'Original file name for file messages';
COMMENT ON COLUMN public.messages.file_type IS 'MIME type of the file (e.g., image/png, application/pdf)';
COMMENT ON COLUMN public.messages.file_size IS 'File size in bytes';

COMMENT ON FUNCTION public.mark_message_as_read(UUID, UUID) IS 'Mark a single message as read by a user';
COMMENT ON FUNCTION public.mark_task_messages_as_read(UUID, UUID) IS 'Mark all messages in a task as read by a user';

