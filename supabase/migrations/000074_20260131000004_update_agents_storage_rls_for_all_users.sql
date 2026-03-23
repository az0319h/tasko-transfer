-- ============================================================================
-- agents Storage 버킷 RLS 정책 수정: 모든 사용자 접근 가능하도록 변경
-- ============================================================================
-- 목적: 모든 인증된 사용자가 에이전트 미디어를 조회/업로드할 수 있도록 변경
-- 
-- 변경 사항:
-- - SELECT: admin만 -> 모든 인증된 사용자
-- - INSERT: admin만 -> 모든 인증된 사용자
-- - UPDATE/DELETE: 자신이 업로드한 것만 (변경 없음)
-- ============================================================================

BEGIN;

-- Storage 버킷 존재 확인
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'agents'
  ) THEN
    RAISE EXCEPTION 'agents Storage 버킷이 존재하지 않습니다.';
  END IF;
END $$;

-- 기존 정책 삭제
DROP POLICY IF EXISTS "agents_storage_select_admin" ON storage.objects;
DROP POLICY IF EXISTS "agents_storage_insert_admin" ON storage.objects;
DROP POLICY IF EXISTS "agents_storage_update_owner" ON storage.objects;
DROP POLICY IF EXISTS "agents_storage_delete_owner" ON storage.objects;

-- Storage RLS 정책 생성 (EXCEPTION 처리 포함)
DO $$
BEGIN
  -- SELECT: 모든 인증된 사용자가 미디어 조회 가능
  CREATE POLICY "agents_storage_select_all"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'agents');

  -- INSERT: 모든 인증된 사용자가 미디어 업로드 가능
  CREATE POLICY "agents_storage_insert_all"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'agents');

  -- UPDATE: 자신이 업로드한 미디어만 수정 가능
  CREATE POLICY "agents_storage_update_owner"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'agents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR name LIKE auth.uid()::text || '/%'
    )
  )
  WITH CHECK (
    bucket_id = 'agents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR name LIKE auth.uid()::text || '/%'
    )
  );

  -- DELETE: 자신이 업로드한 미디어만 삭제 가능
  CREATE POLICY "agents_storage_delete_owner"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'agents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR name LIKE auth.uid()::text || '/%'
    )
  );

  RAISE NOTICE 'agents 버킷의 Storage RLS 정책이 성공적으로 업데이트되었습니다.';
EXCEPTION
  WHEN insufficient_privilege OR OTHERS THEN
    RAISE WARNING 'Storage RLS 정책 생성 실패: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    RAISE WARNING 'agents 버킷의 Storage RLS 정책을 Supabase Dashboard에서 수동으로 설정해야 합니다.';
END $$;

COMMIT;
