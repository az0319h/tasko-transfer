-- RLS Policies for messages table
-- Policy: Users can view messages if they have access to the parent task
-- Policy: Users can create messages if they have access to the parent task

-- Policy: SELECT - Users can see messages if they have access to the parent task
CREATE POLICY "messages_select_task_access"
ON public.messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = messages.task_id
    AND has_project_access(auth.uid(), tasks.project_id)
  )
);

-- Policy: INSERT - Users can create messages if they have access to the parent task
CREATE POLICY "messages_insert_task_access"
ON public.messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = messages.task_id
    AND has_project_access(auth.uid(), tasks.project_id)
  )
  AND auth.uid() = user_id
);

-- Policy: UPDATE - Users can only update their own USER messages (SYSTEM messages are immutable)
CREATE POLICY "messages_update_own_user_messages"
ON public.messages
FOR UPDATE
USING (
  auth.uid() = user_id
  AND message_type = 'USER'
)
WITH CHECK (
  auth.uid() = user_id
  AND message_type = 'USER'
);

-- Policy: DELETE - Users can only delete their own USER messages (SYSTEM messages are immutable)
CREATE POLICY "messages_delete_own_user_messages"
ON public.messages
FOR DELETE
USING (
  auth.uid() = user_id
  AND message_type = 'USER'
);

