-- ============================================================================
-- Phase 2: RLS 정책 성능 최적화 및 보안 강화
-- ============================================================================
-- 목적: 
-- 1. auth.uid() 호출 최적화 (성능 향상)
-- 2. Multiple Permissive Policies 통합 (성능 향상)
-- 3. 함수 search_path 보안 수정 (보안 강화)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. 함수 search_path 보안 수정
-- ----------------------------------------------------------------------------

-- update_updated_at_column 함수
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'update_updated_at_column' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    ALTER FUNCTION public.update_updated_at_column() SET search_path = '';
    RAISE NOTICE 'update_updated_at_column 함수의 search_path를 수정했습니다.';
  END IF;
END $$;

-- can_access_profile 함수
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'can_access_profile' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    ALTER FUNCTION public.can_access_profile(target_user_id UUID) SET search_path = '';
    RAISE NOTICE 'can_access_profile 함수의 search_path를 수정했습니다.';
  END IF;
END $$;

-- handle_new_user 함수
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'handle_new_user' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    ALTER FUNCTION public.handle_new_user() SET search_path = '';
    RAISE NOTICE 'handle_new_user 함수의 search_path를 수정했습니다.';
  END IF;
END $$;

-- mark_message_as_read 함수
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'mark_message_as_read' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    ALTER FUNCTION public.mark_message_as_read(message_id UUID, reader_id UUID) SET search_path = '';
    RAISE NOTICE 'mark_message_as_read 함수의 search_path를 수정했습니다.';
  END IF;
END $$;

-- mark_task_messages_as_read 함수
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'mark_task_messages_as_read' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    ALTER FUNCTION public.mark_task_messages_as_read(reader_id UUID, task_id_param UUID) SET search_path = '';
    RAISE NOTICE 'mark_task_messages_as_read 함수의 search_path를 수정했습니다.';
  END IF;
END $$;

-- send_task_created_email 함수
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'send_task_created_email' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    ALTER FUNCTION public.send_task_created_email() SET search_path = '';
    RAISE NOTICE 'send_task_created_email 함수의 search_path를 수정했습니다.';
  END IF;
END $$;

-- create_task_created_system_message 함수
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'create_task_created_system_message' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    ALTER FUNCTION public.create_task_created_system_message() SET search_path = '';
    RAISE NOTICE 'create_task_created_system_message 함수의 search_path를 수정했습니다.';
  END IF;
END $$;

-- send_task_status_change_email 함수
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'send_task_status_change_email' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    ALTER FUNCTION public.send_task_status_change_email() SET search_path = '';
    RAISE NOTICE 'send_task_status_change_email 함수의 search_path를 수정했습니다.';
  END IF;
END $$;

-- create_task_status_change_system_message 함수
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'create_task_status_change_system_message' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    ALTER FUNCTION public.create_task_status_change_system_message() SET search_path = '';
    RAISE NOTICE 'create_task_status_change_system_message 함수의 search_path를 수정했습니다.';
  END IF;
END $$;

-- get_active_profiles 함수
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'get_active_profiles' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    ALTER FUNCTION public.get_active_profiles() SET search_path = '';
    RAISE NOTICE 'get_active_profiles 함수의 search_path를 수정했습니다.';
  END IF;
END $$;

-- sync_profile_email_on_auth_email_change 함수
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'sync_profile_email_on_auth_email_change' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    ALTER FUNCTION public.sync_profile_email_on_auth_email_change() SET search_path = '';
    RAISE NOTICE 'sync_profile_email_on_auth_email_change 함수의 search_path를 수정했습니다.';
  END IF;
END $$;

-- has_project_access 함수
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'has_project_access' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    ALTER FUNCTION public.has_project_access(project_id UUID, user_id UUID) SET search_path = '';
    RAISE NOTICE 'has_project_access 함수의 search_path를 수정했습니다.';
  END IF;
END $$;

-- is_admin 함수
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'is_admin' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    ALTER FUNCTION public.is_admin(user_id UUID) SET search_path = '';
    RAISE NOTICE 'is_admin 함수의 search_path를 수정했습니다.';
  END IF;
END $$;

-- is_project_participant 함수
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'is_project_participant' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    ALTER FUNCTION public.is_project_participant(user_id UUID, project_id UUID) SET search_path = '';
    RAISE NOTICE 'is_project_participant 함수의 search_path를 수정했습니다.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. profiles 테이블 RLS 정책 통합 및 최적화
-- ----------------------------------------------------------------------------

-- 기존 SELECT 정책 삭제
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_same_project" ON public.profiles;

-- 통합된 SELECT 정책 생성 (auth.uid() 최적화 적용)
CREATE POLICY "profiles_select_unified" ON public.profiles
  FOR SELECT
  USING (
    (SELECT auth.uid()) = id 
    OR is_admin((SELECT auth.uid()))
    OR can_access_profile(id)
  );

-- 기존 UPDATE 정책 삭제
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- 통합된 UPDATE 정책 생성 (auth.uid() 최적화 적용)
CREATE POLICY "profiles_update_unified" ON public.profiles
  FOR UPDATE
  USING (
    (SELECT auth.uid()) = id 
    OR is_admin((SELECT auth.uid()))
  );

-- INSERT 정책 최적화 (auth.uid() 최적화 적용)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "profiles_insert_unified" ON public.profiles
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = id);

-- ----------------------------------------------------------------------------
-- 3. projects 테이블 RLS 정책 최적화
-- ----------------------------------------------------------------------------

-- SELECT 정책 최적화
DROP POLICY IF EXISTS "projects_select_admin_or_participant" ON public.projects;
CREATE POLICY "projects_select_admin_or_participant" ON public.projects
  FOR SELECT
  USING (
    is_admin((SELECT auth.uid())) 
    OR is_project_participant((SELECT auth.uid()), id)
  );

-- INSERT 정책 최적화
DROP POLICY IF EXISTS "projects_insert_admin_only" ON public.projects;
CREATE POLICY "projects_insert_admin_only" ON public.projects
  FOR INSERT
  WITH CHECK (is_admin((SELECT auth.uid())));

-- UPDATE 정책 최적화
DROP POLICY IF EXISTS "projects_update_admin_only" ON public.projects;
CREATE POLICY "projects_update_admin_only" ON public.projects
  FOR UPDATE
  USING (is_admin((SELECT auth.uid())));

-- DELETE 정책 최적화
DROP POLICY IF EXISTS "projects_delete_admin_only" ON public.projects;
CREATE POLICY "projects_delete_admin_only" ON public.projects
  FOR DELETE
  USING (is_admin((SELECT auth.uid())));

-- ----------------------------------------------------------------------------
-- 4. project_participants 테이블 RLS 정책 최적화
-- ----------------------------------------------------------------------------

-- SELECT 정책 최적화
DROP POLICY IF EXISTS "project_participants_select_participant_or_admin" ON public.project_participants;
CREATE POLICY "project_participants_select_participant_or_admin" ON public.project_participants
  FOR SELECT
  USING (
    is_admin((SELECT auth.uid())) 
    OR (SELECT auth.uid()) = user_id 
    OR is_project_participant((SELECT auth.uid()), project_id)
  );

-- INSERT 정책 최적화
DROP POLICY IF EXISTS "project_participants_insert_admin_only" ON public.project_participants;
CREATE POLICY "project_participants_insert_admin_only" ON public.project_participants
  FOR INSERT
  WITH CHECK (is_admin((SELECT auth.uid())));

-- DELETE 정책 최적화
DROP POLICY IF EXISTS "project_participants_delete_admin_only" ON public.project_participants;
CREATE POLICY "project_participants_delete_admin_only" ON public.project_participants
  FOR DELETE
  USING (is_admin((SELECT auth.uid())));

-- ----------------------------------------------------------------------------
-- 5. tasks 테이블 RLS 정책 통합 및 최적화
-- ----------------------------------------------------------------------------

-- SELECT 정책 최적화
DROP POLICY IF EXISTS "tasks_select_participant_or_admin" ON public.tasks;
CREATE POLICY "tasks_select_participant_or_admin" ON public.tasks
  FOR SELECT
  USING (
    is_admin((SELECT auth.uid())) 
    OR EXISTS (
      SELECT 1 FROM public.project_participants
      WHERE project_participants.project_id = tasks.project_id
        AND project_participants.user_id = (SELECT auth.uid())
    )
  );

-- INSERT 정책 최적화
DROP POLICY IF EXISTS "tasks_insert_participant_or_admin" ON public.tasks;
CREATE POLICY "tasks_insert_participant_or_admin" ON public.tasks
  FOR INSERT
  WITH CHECK (
    is_admin((SELECT auth.uid())) 
    OR EXISTS (
      SELECT 1 FROM public.project_participants
      WHERE project_participants.project_id = tasks.project_id
        AND project_participants.user_id = (SELECT auth.uid())
    )
  );

-- UPDATE 정책 통합 및 최적화 (기존 2개 정책 통합)
DROP POLICY IF EXISTS "tasks_update_assigner_only" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_assignee_status" ON public.tasks;

CREATE POLICY "tasks_update_unified" ON public.tasks
  FOR UPDATE
  USING (
    assigner_id = (SELECT auth.uid())
    OR assignee_id = (SELECT auth.uid())
  )
  WITH CHECK (
    assigner_id = (SELECT auth.uid())
    OR assignee_id = (SELECT auth.uid())
  );

-- DELETE 정책 최적화
DROP POLICY IF EXISTS "tasks_delete_assigner_only" ON public.tasks;
CREATE POLICY "tasks_delete_assigner_only" ON public.tasks
  FOR DELETE
  USING (assigner_id = (SELECT auth.uid()));

-- ----------------------------------------------------------------------------
-- 6. messages 테이블 RLS 정책 최적화
-- ----------------------------------------------------------------------------

-- SELECT 정책 최적화
DROP POLICY IF EXISTS "messages_select_task_access" ON public.messages;
CREATE POLICY "messages_select_task_access" ON public.messages
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      is_admin((SELECT auth.uid()))
      OR EXISTS (
        SELECT 1 FROM public.tasks
        JOIN public.project_participants ON project_participants.project_id = tasks.project_id
        WHERE tasks.id = messages.task_id
          AND project_participants.user_id = (SELECT auth.uid())
      )
    )
  );

-- INSERT 정책 최적화
DROP POLICY IF EXISTS "messages_insert_task_access" ON public.messages;
CREATE POLICY "messages_insert_task_access" ON public.messages
  FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (
      is_admin((SELECT auth.uid()))
      OR EXISTS (
        SELECT 1 FROM public.tasks
        JOIN public.project_participants ON project_participants.project_id = tasks.project_id
        WHERE tasks.id = messages.task_id
          AND project_participants.user_id = (SELECT auth.uid())
      )
    )
  );

-- UPDATE 정책 최적화
DROP POLICY IF EXISTS "messages_update_own_user_message" ON public.messages;
CREATE POLICY "messages_update_own_user_message" ON public.messages
  FOR UPDATE
  USING (
    (SELECT auth.uid()) = user_id
    AND message_type = 'USER'::message_type
    AND deleted_at IS NULL
  )
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND message_type = 'USER'::message_type
  );

-- DELETE 정책 최적화
DROP POLICY IF EXISTS "messages_delete_own_user_message" ON public.messages;
CREATE POLICY "messages_delete_own_user_message" ON public.messages
  FOR DELETE
  USING (
    (SELECT auth.uid()) = user_id
    AND message_type = 'USER'::message_type
    AND deleted_at IS NULL
  );

-- ----------------------------------------------------------------------------
-- 7. email_logs 테이블 RLS 정책 최적화
-- ----------------------------------------------------------------------------

-- SELECT 정책 최적화
DROP POLICY IF EXISTS "email_logs_select_admin_only" ON public.email_logs;
CREATE POLICY "email_logs_select_admin_only" ON public.email_logs
  FOR SELECT
  USING (is_admin((SELECT auth.uid())));

COMMIT;

-- ============================================================================
-- 검증 쿼리 (수동 실행)
-- ============================================================================
-- SELECT schemaname, tablename, policyname, cmd, qual
-- FROM pg_policies 
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;


