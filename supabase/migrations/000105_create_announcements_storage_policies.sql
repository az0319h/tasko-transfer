-- ============================================================================
-- announcements 버킷 Storage RLS 정책 생성
-- ============================================================================
-- 실행 방법: Supabase Dashboard > SQL Editor에서 이 파일 내용을 실행하세요.
-- ============================================================================

-- SELECT 정책: 모든 인증 사용자가 읽기 가능
DROP POLICY IF EXISTS "announcements_storage_select_all" ON storage.objects;
CREATE POLICY "announcements_storage_select_all"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'announcements');

-- INSERT 정책: 관리자만 업로드 가능
DROP POLICY IF EXISTS "announcements_storage_insert_admin" ON storage.objects;
CREATE POLICY "announcements_storage_insert_admin"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'announcements'
  AND is_admin(auth.uid())
);

-- UPDATE 정책: 관리자만 수정 가능
DROP POLICY IF EXISTS "announcements_storage_update_admin" ON storage.objects;
CREATE POLICY "announcements_storage_update_admin"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'announcements'
  AND is_admin(auth.uid())
)
WITH CHECK (
  bucket_id = 'announcements'
  AND is_admin(auth.uid())
);

-- DELETE 정책: 관리자만 삭제 가능
DROP POLICY IF EXISTS "announcements_storage_delete_admin" ON storage.objects;
CREATE POLICY "announcements_storage_delete_admin"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'announcements'
  AND is_admin(auth.uid())
);

-- RLS 정책 코멘트 추가
COMMENT ON POLICY "announcements_storage_select_all" ON storage.objects IS 
'공지사항 스토리지 읽기 정책: 모든 인증 사용자가 announcements 버킷의 파일을 읽을 수 있음';

COMMENT ON POLICY "announcements_storage_insert_admin" ON storage.objects IS 
'공지사항 스토리지 업로드 정책: 관리자만 announcements 버킷에 파일을 업로드할 수 있음';

COMMENT ON POLICY "announcements_storage_update_admin" ON storage.objects IS 
'공지사항 스토리지 수정 정책: 관리자만 announcements 버킷의 파일을 수정할 수 있음';

COMMENT ON POLICY "announcements_storage_delete_admin" ON storage.objects IS 
'공지사항 스토리지 삭제 정책: 관리자만 announcements 버킷의 파일을 삭제할 수 있음';
