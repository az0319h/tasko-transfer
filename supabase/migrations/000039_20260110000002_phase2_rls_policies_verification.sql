-- ============================================================================
-- Phase 2: RLS 정책 검증 및 보완
-- ============================================================================
-- 목적: @tasks.json Task 3 요구사항에 맞춰 모든 테이블의 RLS 정책을 검증하고 보완
-- 
-- 작업 내용:
-- 1. profiles 테이블 RLS 정책 확인 및 보완
-- 2. projects 테이블 RLS 정책 확인 및 보완
-- 3. project_participants 테이블 RLS 정책 확인 및 보완
-- 4. tasks 테이블 RLS 정책 확인 및 보완
-- 5. messages 테이블 RLS 정책 확인 및 보완
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. profiles 테이블 RLS 정책 보완
-- ----------------------------------------------------------------------------

-- 기존 정책 확인 및 삭제 (중복 방지)
DROP POLICY IF EXISTS "profiles_select_unified" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_unified" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_unified" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_same_project" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- SELECT 정책: 본인 또는 Admin 또는 동일 프로젝트 참여자
CREATE POLICY "profiles_select_own_or_admin_or_same_project"
ON public.profiles
FOR SELECT
USING (
  (SELECT auth.uid()) = id
  OR is_admin((SELECT auth.uid()))
  OR can_access_profile(id)
);

-- UPDATE 정책: 본인만 (Admin은 애플리케이션 레벨에서 처리)
CREATE POLICY "profiles_update_own"
ON public.profiles
FOR UPDATE
USING ((SELECT auth.uid()) = id)
WITH CHECK ((SELECT auth.uid()) = id);

-- INSERT 정책: 본인만 (auth.users 트리거를 통해 자동 생성)
CREATE POLICY "profiles_insert_own"
ON public.profiles
FOR INSERT
WITH CHECK ((SELECT auth.uid()) = id);

COMMENT ON POLICY "profiles_select_own_or_admin_or_same_project" ON public.profiles IS 
'프로필 조회 정책: 본인, Admin, 또는 동일 프로젝트 참여자만 조회 가능';
COMMENT ON POLICY "profiles_update_own" ON public.profiles IS 
'프로필 수정 정책: 본인만 수정 가능';
COMMENT ON POLICY "profiles_insert_own" ON public.profiles IS 
'프로필 생성 정책: 본인만 생성 가능 (auth.users 트리거를 통해 자동 생성)';

-- ----------------------------------------------------------------------------
-- 2. projects 테이블 RLS 정책 보완
-- ----------------------------------------------------------------------------

-- 기존 정책 확인 및 삭제 (중복 방지)
DROP POLICY IF EXISTS "projects_select_admin_or_participant" ON public.projects;
DROP POLICY IF EXISTS "projects_insert_admin_only" ON public.projects;
DROP POLICY IF EXISTS "projects_update_admin_only" ON public.projects;
DROP POLICY IF EXISTS "projects_delete_admin_only" ON public.projects;
DROP POLICY IF EXISTS "projects_select_public_or_authorized" ON public.projects;
DROP POLICY IF EXISTS "projects_insert_authenticated" ON public.projects;

-- SELECT 정책: Admin 또는 프로젝트 참여자
CREATE POLICY "projects_select_admin_or_participant"
ON public.projects
FOR SELECT
USING (
  is_admin((SELECT auth.uid()))
  OR is_project_participant((SELECT auth.uid()), id)
);

-- INSERT 정책: Admin만
CREATE POLICY "projects_insert_admin_only"
ON public.projects
FOR INSERT
WITH CHECK (is_admin((SELECT auth.uid())));

-- UPDATE 정책: Admin만
CREATE POLICY "projects_update_admin_only"
ON public.projects
FOR UPDATE
USING (is_admin((SELECT auth.uid())))
WITH CHECK (is_admin((SELECT auth.uid())));

-- DELETE 정책: Admin만
CREATE POLICY "projects_delete_admin_only"
ON public.projects
FOR DELETE
USING (is_admin((SELECT auth.uid())));

COMMENT ON POLICY "projects_select_admin_or_participant" ON public.projects IS 
'프로젝트 조회 정책: Admin 또는 프로젝트 참여자만 조회 가능';
COMMENT ON POLICY "projects_insert_admin_only" ON public.projects IS 
'프로젝트 생성 정책: Admin만 생성 가능';
COMMENT ON POLICY "projects_update_admin_only" ON public.projects IS 
'프로젝트 수정 정책: Admin만 수정 가능';
COMMENT ON POLICY "projects_delete_admin_only" ON public.projects IS 
'프로젝트 삭제 정책: Admin만 삭제 가능';

-- ----------------------------------------------------------------------------
-- 3. project_participants 테이블 RLS 정책 보완
-- ----------------------------------------------------------------------------

-- 기존 정책 확인 및 삭제 (중복 방지)
DROP POLICY IF EXISTS "project_participants_select_participant_or_admin" ON public.project_participants;
DROP POLICY IF EXISTS "project_participants_insert_admin_only" ON public.project_participants;
DROP POLICY IF EXISTS "project_participants_delete_admin_only" ON public.project_participants;

-- SELECT 정책: 참여자 또는 Admin
CREATE POLICY "project_participants_select_participant_or_admin"
ON public.project_participants
FOR SELECT
USING (
  is_admin((SELECT auth.uid()))
  OR (SELECT auth.uid()) = user_id
  OR is_project_participant((SELECT auth.uid()), project_id)
);

-- INSERT 정책: Admin만
CREATE POLICY "project_participants_insert_admin_only"
ON public.project_participants
FOR INSERT
WITH CHECK (is_admin((SELECT auth.uid())));

-- DELETE 정책: Admin만
CREATE POLICY "project_participants_delete_admin_only"
ON public.project_participants
FOR DELETE
USING (is_admin((SELECT auth.uid())));

COMMENT ON POLICY "project_participants_select_participant_or_admin" ON public.project_participants IS 
'프로젝트 참여자 조회 정책: 참여자 또는 Admin만 조회 가능';
COMMENT ON POLICY "project_participants_insert_admin_only" ON public.project_participants IS 
'프로젝트 참여자 추가 정책: Admin만 추가 가능';
COMMENT ON POLICY "project_participants_delete_admin_only" ON public.project_participants IS 
'프로젝트 참여자 삭제 정책: Admin만 삭제 가능';

-- ----------------------------------------------------------------------------
-- 4. tasks 테이블 RLS 정책 보완
-- ----------------------------------------------------------------------------

-- 기존 정책 확인 및 삭제 (중복 방지)
DROP POLICY IF EXISTS "tasks_select_participant_or_admin" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert_participant_or_admin" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_admin_general_fields" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_status_assigner_assignee" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete_assigner_only" ON public.tasks;

-- SELECT 정책: 프로젝트 참여자 또는 Admin
CREATE POLICY "tasks_select_participant_or_admin"
ON public.tasks
FOR SELECT
USING (
  is_admin((SELECT auth.uid()))
  OR is_project_participant((SELECT auth.uid()), project_id)
);

-- INSERT 정책: 프로젝트 참여자 또는 Admin
CREATE POLICY "tasks_insert_participant_or_admin"
ON public.tasks
FOR INSERT
WITH CHECK (
  is_admin((SELECT auth.uid()))
  OR is_project_participant((SELECT auth.uid()), project_id)
);

-- UPDATE 정책: Admin (일반 필드) 또는 지시자/담당자 (상태 변경)
-- Note: 컬럼별 정책은 PostgreSQL 17.6+에서만 지원되므로, 애플리케이션 레벨에서 제어
CREATE POLICY "tasks_update_admin_or_assigner_assignee"
ON public.tasks
FOR UPDATE
USING (
  is_admin((SELECT auth.uid()))
  OR (SELECT auth.uid()) = assigner_id
  OR (SELECT auth.uid()) = assignee_id
)
WITH CHECK (
  is_admin((SELECT auth.uid()))
  OR (SELECT auth.uid()) = assigner_id
  OR (SELECT auth.uid()) = assignee_id
);

-- DELETE 정책: 지시자만
CREATE POLICY "tasks_delete_assigner_only"
ON public.tasks
FOR DELETE
USING ((SELECT auth.uid()) = assigner_id);

COMMENT ON POLICY "tasks_select_participant_or_admin" ON public.tasks IS 
'Task 조회 정책: 프로젝트 참여자 또는 Admin만 조회 가능';
COMMENT ON POLICY "tasks_insert_participant_or_admin" ON public.tasks IS 
'Task 생성 정책: 프로젝트 참여자 또는 Admin만 생성 가능';
COMMENT ON POLICY "tasks_update_admin_or_assigner_assignee" ON public.tasks IS 
'Task 수정 정책: Admin 또는 지시자/담당자만 수정 가능 (상태 변경은 애플리케이션 레벨에서 제어)';
COMMENT ON POLICY "tasks_delete_assigner_only" ON public.tasks IS 
'Task 삭제 정책: 지시자만 삭제 가능';

-- ----------------------------------------------------------------------------
-- 5. messages 테이블 RLS 정책 보완
-- ----------------------------------------------------------------------------

-- 기존 정책 확인 및 삭제 (중복 방지)
DROP POLICY IF EXISTS "messages_select_task_access" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_task_access" ON public.messages;
DROP POLICY IF EXISTS "messages_update_own_user_messages" ON public.messages;
DROP POLICY IF EXISTS "messages_delete_own_user_messages" ON public.messages;

-- SELECT 정책: Task 접근 권한 필요
CREATE POLICY "messages_select_task_access"
ON public.messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = messages.task_id
    AND (
      is_admin((SELECT auth.uid()))
      OR is_project_participant((SELECT auth.uid()), tasks.project_id)
    )
  )
);

-- INSERT 정책: Task 접근 권한 필요
CREATE POLICY "messages_insert_task_access"
ON public.messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = messages.task_id
    AND (
      is_admin((SELECT auth.uid()))
      OR is_project_participant((SELECT auth.uid()), tasks.project_id)
    )
  )
);

-- UPDATE 정책: 본인 작성 USER/FILE 메시지만
CREATE POLICY "messages_update_own_user_file_messages"
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

-- DELETE 정책: 본인 작성 USER 메시지만 (소프트 삭제)
CREATE POLICY "messages_delete_own_user_messages"
ON public.messages
FOR DELETE
USING (
  (SELECT auth.uid()) = user_id
  AND message_type = 'USER'
);

COMMENT ON POLICY "messages_select_task_access" ON public.messages IS 
'메시지 조회 정책: Task 접근 권한이 있는 사용자만 조회 가능';
COMMENT ON POLICY "messages_insert_task_access" ON public.messages IS 
'메시지 생성 정책: Task 접근 권한이 있는 사용자만 생성 가능';
COMMENT ON POLICY "messages_update_own_user_file_messages" ON public.messages IS 
'메시지 수정 정책: 본인 작성 USER/FILE 메시지만 수정 가능 (소프트 삭제용)';
COMMENT ON POLICY "messages_delete_own_user_messages" ON public.messages IS 
'메시지 삭제 정책: 본인 작성 USER 메시지만 삭제 가능 (소프트 삭제)';

COMMIT;

-- ============================================================================
-- 검증 쿼리 (수동 실행)
-- ============================================================================
-- RLS 정책 확인:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;


