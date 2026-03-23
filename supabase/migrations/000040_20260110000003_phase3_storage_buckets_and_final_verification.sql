-- ============================================================================
-- Phase 3: Storage 버킷 생성 및 최종 검증
-- ============================================================================
-- 목적: @tasks.json Task 3.10 요구사항에 맞춰 Storage 버킷 생성 및 권한 설정
-- 
-- 작업 내용:
-- 1. avatars Storage 버킷 생성 및 권한 설정
-- 2. task-files 버킷 권한 재확인
-- 3. 모든 트리거 및 함수 최종 검증
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. avatars Storage 버킷 생성 및 권한 설정
-- ----------------------------------------------------------------------------

-- avatars 버킷 생성 (없는 경우)
-- Note: Storage 버킷은 Supabase Dashboard 또는 Storage API를 통해 생성해야 함
-- 이 마이그레이션은 버킷이 이미 존재한다고 가정하고 권한만 설정함

-- avatars 버킷 RLS Policies
-- Policy: 사용자는 자신의 프로필 이미지만 업로드/다운로드 가능

-- 업로드 정책: 본인만 업로드 가능
DROP POLICY IF EXISTS "avatars_upload_own" ON storage.objects;
CREATE POLICY "avatars_upload_own"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

-- 다운로드 정책: 모든 인증된 사용자 (프로필 이미지는 공개)
DROP POLICY IF EXISTS "avatars_read_public" ON storage.objects;
CREATE POLICY "avatars_read_public"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

-- 삭제 정책: 본인만 삭제 가능
DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

COMMENT ON POLICY "avatars_upload_own" ON storage.objects IS 
'avatars 버킷 업로드 정책: 본인만 자신의 프로필 이미지 업로드 가능 (경로: avatars/{userId}/{filename})';
COMMENT ON POLICY "avatars_read_public" ON storage.objects IS 
'avatars 버킷 다운로드 정책: 모든 인증된 사용자가 프로필 이미지 다운로드 가능';
COMMENT ON POLICY "avatars_delete_own" ON storage.objects IS 
'avatars 버킷 삭제 정책: 본인만 자신의 프로필 이미지 삭제 가능';

-- ----------------------------------------------------------------------------
-- 2. task-files 버킷 권한 재확인
-- ----------------------------------------------------------------------------

-- task-files 버킷 RLS Policies 재확인 및 보완

-- 업로드 정책: Task 접근 권한이 있는 사용자만 업로드 가능
DROP POLICY IF EXISTS "task_files_upload" ON storage.objects;
CREATE POLICY "task_files_upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'task-files'
  AND EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id::text = (storage.foldername(name))[1]
    AND (
      is_admin((SELECT auth.uid()))
      OR tasks.assigner_id = (SELECT auth.uid())
      OR tasks.assignee_id = (SELECT auth.uid())
    )
  )
);

-- 다운로드 정책: Task 접근 권한이 있는 사용자만 다운로드 가능
DROP POLICY IF EXISTS "task_files_read" ON storage.objects;
CREATE POLICY "task_files_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'task-files'
  AND EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id::text = (storage.foldername(name))[1]
    AND (
      is_admin((SELECT auth.uid()))
      OR tasks.assigner_id = (SELECT auth.uid())
      OR tasks.assignee_id = (SELECT auth.uid())
    )
  )
);

-- 삭제 정책: 본인이 업로드한 파일만 삭제 가능
DROP POLICY IF EXISTS "task_files_delete" ON storage.objects;
CREATE POLICY "task_files_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'task-files'
  AND (storage.foldername(name))[2] = (SELECT auth.uid())::text
);

COMMENT ON POLICY "task_files_upload" ON storage.objects IS 
'task-files 버킷 업로드 정책: Task 접근 권한이 있는 사용자만 업로드 가능 (경로: task-files/{taskId}/{userId}/{filename})';
COMMENT ON POLICY "task_files_read" ON storage.objects IS 
'task-files 버킷 다운로드 정책: Task 접근 권한이 있는 사용자만 다운로드 가능';
COMMENT ON POLICY "task_files_delete" ON storage.objects IS 
'task-files 버킷 삭제 정책: 본인이 업로드한 파일만 삭제 가능';

-- ----------------------------------------------------------------------------
-- 3. 트리거 및 함수 최종 검증
-- ----------------------------------------------------------------------------

-- Task 생성 시 이메일 발송 트리거 확인
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trigger_send_task_created_email'
  ) THEN
    RAISE EXCEPTION '트리거 trigger_send_task_created_email가 존재하지 않습니다.';
  ELSE
    RAISE NOTICE '트리거 trigger_send_task_created_email가 존재합니다.';
  END IF;
END $$;

-- Task 생성 시 시스템 메시지 생성 트리거 확인
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trigger_create_task_created_system_message'
  ) THEN
    RAISE EXCEPTION '트리거 trigger_create_task_created_system_message가 존재하지 않습니다.';
  ELSE
    RAISE NOTICE '트리거 trigger_create_task_created_system_message가 존재합니다.';
  END IF;
END $$;

-- Task 상태 변경 시 이메일 발송 트리거 확인
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trigger_send_task_status_change_email'
  ) THEN
    RAISE EXCEPTION '트리거 trigger_send_task_status_change_email가 존재하지 않습니다.';
  ELSE
    RAISE NOTICE '트리거 trigger_send_task_status_change_email가 존재합니다.';
  END IF;
END $$;

-- Task 상태 변경 시 시스템 메시지 생성 트리거 확인
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trigger_create_task_status_change_system_message'
  ) THEN
    RAISE EXCEPTION '트리거 trigger_create_task_status_change_system_message가 존재하지 않습니다.';
  ELSE
    RAISE NOTICE '트리거 trigger_create_task_status_change_system_message가 존재합니다.';
  END IF;
END $$;

-- 읽음 처리 함수 확인
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'mark_message_as_read'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    RAISE EXCEPTION '함수 mark_message_as_read가 존재하지 않습니다.';
  ELSE
    RAISE NOTICE '함수 mark_message_as_read가 존재합니다.';
  END IF;
END $$;

-- Task 전체 메시지 읽음 처리 함수 확인
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'mark_task_messages_as_read'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    RAISE EXCEPTION '함수 mark_task_messages_as_read가 존재하지 않습니다.';
  ELSE
    RAISE NOTICE '함수 mark_task_messages_as_read가 존재합니다.';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- 검증 쿼리 (수동 실행)
-- ============================================================================
-- Storage 버킷 확인:
-- SELECT id, name, public, file_size_limit, allowed_mime_types
-- FROM storage.buckets
-- WHERE id IN ('avatars', 'task-files');
--
-- Storage 정책 확인:
-- SELECT policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'storage'
-- ORDER BY tablename, policyname;
--
-- 트리거 확인:
-- SELECT tgname, tgrelid::regclass, tgenabled
-- FROM pg_trigger
-- WHERE tgname LIKE 'trigger_%'
-- ORDER BY tgname;
--
-- 함수 확인:
-- SELECT proname, proargtypes::regtype[]
-- FROM pg_proc
-- WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
--   AND proname IN ('mark_message_as_read', 'mark_task_messages_as_read')
-- ORDER BY proname;


