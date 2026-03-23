-- Remove old message_logs system completely
-- This migration removes all old message_logs related tables, triggers, functions, and policies

-- 1. Drop triggers related to message_logs
DROP TRIGGER IF EXISTS trigger_02_create_message_log_on_status_change ON public.tasks;
DROP TRIGGER IF EXISTS trigger_update_message_log_count_on_insert ON public.messages;
DROP TRIGGER IF EXISTS trigger_update_message_log_count_on_delete ON public.messages;
DROP TRIGGER IF EXISTS trigger_update_message_logs_updated_at ON public.message_logs;

-- 2. Drop functions related to message_logs
DROP FUNCTION IF EXISTS public.create_message_log_on_status_change() CASCADE;
DROP FUNCTION IF EXISTS public.update_message_log_count_on_message_insert() CASCADE;
DROP FUNCTION IF EXISTS public.update_message_log_count_on_message_delete() CASCADE;
DROP FUNCTION IF EXISTS public.update_message_logs_updated_at() CASCADE;

-- 3. Drop RLS policies on message_logs
DROP POLICY IF EXISTS "message_logs_select_task_access" ON public.message_logs;
DROP POLICY IF EXISTS "message_logs_insert_trigger_only" ON public.message_logs;
DROP POLICY IF EXISTS "message_logs_update_trigger_only" ON public.message_logs;
DROP POLICY IF EXISTS "message_logs_delete_trigger_only" ON public.message_logs;

-- 4. Drop indexes on message_logs
DROP INDEX IF EXISTS public.idx_message_logs_task_id;
DROP INDEX IF EXISTS public.idx_message_logs_created_at;
DROP INDEX IF EXISTS public.idx_message_logs_task_created;
DROP INDEX IF EXISTS public.idx_message_logs_system_message_id;
DROP INDEX IF EXISTS public.idx_message_logs_previous_system_message_id;

-- 5. Drop the message_logs table (CASCADE will handle foreign keys)
DROP TABLE IF EXISTS public.message_logs CASCADE;

-- 6. Drop realtime subscription if exists (handled by Supabase, but document it)
-- Note: Realtime subscriptions are managed by Supabase and will be automatically cleaned up

COMMENT ON SCHEMA public IS 'Old message_logs system has been removed. New task_chat_logs system will be created in next migration.';
