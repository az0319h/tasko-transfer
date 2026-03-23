-- Switch chat log creation from status-based to file-upload-based
-- This migration adds bundle_id and is_log_anchor to messages,
-- adds title to task_chat_logs, and creates a new trigger-based log creation system

-- 1. Add bundle_id and is_log_anchor columns to messages table
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS bundle_id UUID,
  ADD COLUMN IF NOT EXISTS is_log_anchor BOOLEAN NOT NULL DEFAULT false;

-- 2. Add indexes for bundle_id and is_log_anchor queries
CREATE INDEX IF NOT EXISTS idx_messages_bundle_id ON public.messages(bundle_id) WHERE bundle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_is_log_anchor ON public.messages(is_log_anchor) WHERE is_log_anchor = true;
CREATE INDEX IF NOT EXISTS idx_messages_task_bundle ON public.messages(task_id, bundle_id) WHERE bundle_id IS NOT NULL;

-- 3. Add title column to task_chat_logs table (for file names)
ALTER TABLE public.task_chat_logs
  ADD COLUMN IF NOT EXISTS title TEXT;

-- 4. Add index for title queries (if needed)
CREATE INDEX IF NOT EXISTS idx_task_chat_logs_title ON public.task_chat_logs(title) WHERE title IS NOT NULL;

-- 5. Create function to create chat log when file upload bundle completes
-- This function is triggered when a message with is_log_anchor=true is inserted
CREATE OR REPLACE FUNCTION public.create_chat_log_on_file_upload()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
  v_last_log_created_at TIMESTAMPTZ;
  v_task_start_time TIMESTAMPTZ;
  v_message_record RECORD;
  v_position INTEGER := 0;
  v_file_names TEXT[] := ARRAY[]::TEXT[];
  v_title TEXT;
BEGIN
  -- Only process if this is a log anchor (last message of a file-including bundle)
  IF NEW.is_log_anchor IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Get task start time (when status changed to IN_PROGRESS)
  -- If task hasn't started yet, use task creation time
  SELECT 
    COALESCE(
      (SELECT created_at FROM public.task_chat_logs 
       WHERE task_id = NEW.task_id 
       AND log_type = 'START' 
       ORDER BY created_at ASC LIMIT 1),
      (SELECT created_at FROM public.tasks WHERE id = NEW.task_id)
    ) INTO v_task_start_time;

  -- Get last log's created_at for this task
  SELECT created_at INTO v_last_log_created_at
  FROM public.task_chat_logs
  WHERE task_id = NEW.task_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- Collect file names from this bundle for the log title
  SELECT ARRAY_AGG(file_name ORDER BY created_at ASC)
  INTO v_file_names
  FROM public.messages
  WHERE task_id = NEW.task_id
    AND bundle_id = NEW.bundle_id
    AND message_type = 'FILE'
    AND file_name IS NOT NULL;

  -- Create title from file names (comma-separated)
  IF v_file_names IS NOT NULL AND array_length(v_file_names, 1) > 0 THEN
    v_title := array_to_string(v_file_names, ', ');
  ELSE
    -- Fallback: use bundle_id if no file names found (shouldn't happen, but safety)
    v_title := 'Files';
  END IF;

  -- Create the log
  INSERT INTO public.task_chat_logs (
    task_id,
    created_by,
    log_type,
    title,
    created_at
  ) VALUES (
    NEW.task_id,
    NEW.user_id,
    'START'::chat_log_type, -- File upload logs use START type (can be changed if needed)
    v_title,
    NEW.created_at -- Use anchor message's created_at as log timestamp
  )
  RETURNING id INTO v_log_id;

  -- Collect all messages in the range:
  -- - If last log exists: from last_log_created_at to current anchor (inclusive)
  -- - If no last log: from task_start_time to current anchor (inclusive)
  FOR v_message_record IN
    SELECT id, created_at
    FROM public.messages
    WHERE task_id = NEW.task_id
      AND message_type IN ('USER', 'FILE')
      AND deleted_at IS NULL
      AND (
        -- If last log exists: messages after last log
        (v_last_log_created_at IS NOT NULL AND created_at > v_last_log_created_at)
        OR
        -- If no last log: messages after task start
        (v_last_log_created_at IS NULL AND created_at >= v_task_start_time)
      )
      AND created_at <= NEW.created_at -- Up to and including the anchor message
    ORDER BY created_at ASC
  LOOP
    INSERT INTO public.task_chat_log_items (
      log_id,
      message_id,
      position
    ) VALUES (
      v_log_id,
      v_message_record.id,
      v_position
    )
    ON CONFLICT (log_id, message_id) DO NOTHING; -- Prevent duplicates
    
    v_position := v_position + 1;
  END LOOP;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the message insert
    RAISE WARNING 'Failed to create chat log on file upload: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- 6. Create trigger to call the function on message insert
DROP TRIGGER IF EXISTS trigger_create_chat_log_on_file_upload ON public.messages;
CREATE TRIGGER trigger_create_chat_log_on_file_upload
  AFTER INSERT ON public.messages
  FOR EACH ROW
  WHEN (NEW.is_log_anchor = true)
  EXECUTE FUNCTION public.create_chat_log_on_file_upload();

-- 7. Disable/Remove old status-based log creation
-- Rename the old function to indicate it's deprecated (don't delete for now, in case we need to rollback)
ALTER FUNCTION public.create_task_chat_log(UUID, task_status, UUID) RENAME TO create_task_chat_log_deprecated;

-- 8. Add comments
COMMENT ON COLUMN public.messages.bundle_id IS 'UUID identifying messages from the same transmission bundle (text + files sent together)';
COMMENT ON COLUMN public.messages.is_log_anchor IS 'True for the last message of a file-including bundle. When true, triggers chat log creation.';
COMMENT ON COLUMN public.task_chat_logs.title IS 'Comma-separated list of file names included in this log (for file-upload-based logs)';
COMMENT ON FUNCTION public.create_chat_log_on_file_upload() IS 'Creates a chat log when a file upload bundle completes (is_log_anchor=true). References messages from last log to current anchor.';
