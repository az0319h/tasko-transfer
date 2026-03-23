-- Add soft delete support for messages
-- This migration adds deleted_at column and updates RLS policies to allow FILE message deletion

-- 1. Add deleted_at column to messages table
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2. Add index for performance optimization (partial index for non-deleted messages)
CREATE INDEX IF NOT EXISTS idx_messages_deleted_at 
ON public.messages(deleted_at) 
WHERE deleted_at IS NULL;

-- 3. Update RLS policy to allow UPDATE for FILE messages (for soft delete)
-- Reason: Currently only USER messages can be updated, but we need to allow FILE messages
-- to be soft-deleted as well. Soft delete is implemented as UPDATE (setting deleted_at).
DROP POLICY IF EXISTS "messages_update_own_user_messages" ON public.messages;
CREATE POLICY "messages_update_own_user_messages"
ON public.messages
FOR UPDATE
USING (
  (SELECT auth.uid()) = user_id
  AND (message_type = 'USER' OR message_type = 'FILE')
)
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND (message_type = 'USER' OR message_type = 'FILE')
);

-- 4. Add comment
COMMENT ON COLUMN public.messages.deleted_at IS 'Timestamp when the message was soft-deleted. NULL means the message is active.';


