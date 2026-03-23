-- ============================================================================
-- agents Storage 버킷 RLS 정책 마이그레이션
-- ============================================================================
-- 목적: agents Storage 버킷에 대한 RLS 정책 설정
-- 
-- 사전 요구사항:
-- 1. agents Storage 버킷이 Supabase Dashboard에서 생성되어 있어야 합니다.
-- 2. 버킷 이름: agents
-- 3. 버킷 설정: Public = true
-- 
-- 주의사항:
-- - 파일 경로 구조는 {userId}/{agentId}/{timestamp}.{ext} 형식을 가정합니다.
-- - 실제 파일 경로 구조에 맞게 정책을 수정해야 할 수 있습니다.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Storage 버킷 존재 확인
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'agents'
  ) THEN
    RAISE EXCEPTION 'agents Storage 버킷이 존재하지 않습니다. 먼저 Supabase Dashboard에서 버킷을 생성해주세요.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 기존 정책 삭제 (있는 경우)
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "agents_storage_select_admin" ON storage.objects;
DROP POLICY IF EXISTS "agents_storage_insert_admin" ON storage.objects;
DROP POLICY IF EXISTS "agents_storage_update_owner" ON storage.objects;
DROP POLICY IF EXISTS "agents_storage_delete_owner" ON storage.objects;

-- ----------------------------------------------------------------------------
-- Storage RLS 정책 생성
-- ----------------------------------------------------------------------------
-- ⚠️ 주의: storage.objects에 대한 정책 생성은 권한 오류가 발생할 수 있습니다.
-- 실패 시 경고만 출력하고 마이그레이션을 계속 진행합니다.
-- 정책 생성이 실패하면 Supabase Dashboard에서 수동으로 설정해야 합니다.

DO $$
BEGIN
  -- SELECT: 모든 관리자가 이미지 조회 가능
  DROP POLICY IF EXISTS "agents_storage_select_admin" ON storage.objects;
  CREATE POLICY "agents_storage_select_admin"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'agents'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

  -- INSERT: 모든 관리자가 이미지 업로드 가능
  DROP POLICY IF EXISTS "agents_storage_insert_admin" ON storage.objects;
  CREATE POLICY "agents_storage_insert_admin"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'agents'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

  -- UPDATE: 자신이 업로드한 이미지만 수정 가능
  -- 파일 경로 구조: {userId}/{agentId}/{timestamp}.{ext} 또는 {userId}/{filename}
  DROP POLICY IF EXISTS "agents_storage_update_owner" ON storage.objects;
  CREATE POLICY "agents_storage_update_owner"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'agents'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
    AND (
      -- 경로의 첫 번째 폴더가 사용자 ID인 경우
      (storage.foldername(name))[1] = auth.uid()::text
      -- 또는 전체 경로가 사용자 ID로 시작하는 경우
      OR name LIKE auth.uid()::text || '/%'
    )
  )
  WITH CHECK (
    bucket_id = 'agents'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR name LIKE auth.uid()::text || '/%'
    )
  );

  -- DELETE: 자신이 업로드한 이미지만 삭제 가능
  DROP POLICY IF EXISTS "agents_storage_delete_owner" ON storage.objects;
  CREATE POLICY "agents_storage_delete_owner"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'agents'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR name LIKE auth.uid()::text || '/%'
    )
  );

  -- 코멘트 추가
  COMMENT ON POLICY "agents_storage_select_admin" ON storage.objects IS 'agents 버킷: 모든 관리자가 이미지 조회 가능';
  COMMENT ON POLICY "agents_storage_insert_admin" ON storage.objects IS 'agents 버킷: 모든 관리자가 이미지 업로드 가능';
  COMMENT ON POLICY "agents_storage_update_owner" ON storage.objects IS 'agents 버킷: 자신이 업로드한 이미지만 수정 가능';
  COMMENT ON POLICY "agents_storage_delete_owner" ON storage.objects IS 'agents 버킷: 자신이 업로드한 이미지만 삭제 가능';

  RAISE NOTICE 'agents 버킷의 Storage RLS 정책이 성공적으로 생성되었습니다.';
EXCEPTION
  WHEN insufficient_privilege OR OTHERS THEN
    RAISE WARNING 'Storage RLS 정책 생성 실패: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    RAISE WARNING 'agents 버킷의 Storage RLS 정책을 Supabase Dashboard에서 수동으로 설정해야 합니다.';
    RAISE WARNING '필요한 정책:';
    RAISE WARNING '  1. SELECT: 관리자만 (bucket_id = ''agents'' AND role = ''admin'')';
    RAISE WARNING '  2. INSERT: 관리자만 (bucket_id = ''agents'' AND role = ''admin'')';
    RAISE WARNING '  3. UPDATE: 자신이 업로드한 파일만 (bucket_id = ''agents'' AND 경로가 자신의 ID로 시작)';
    RAISE WARNING '  4. DELETE: 자신이 업로드한 파일만 (bucket_id = ''agents'' AND 경로가 자신의 ID로 시작)';
END $$;

COMMIT;
