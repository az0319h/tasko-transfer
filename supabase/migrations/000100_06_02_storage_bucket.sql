-- ============================================================================
-- Phase 1: Task 6-2 - 공지사항 스토리지 버킷 생성 및 RLS 정책
-- ============================================================================
-- 목적: announcements 스토리지 버킷 생성 및 RLS 정책 설정
-- 
-- 작업 내용:
-- 1. announcements 스토리지 버킷 생성
-- 2. RLS 정책 설정 (읽기: 모든 인증 사용자, 쓰기/삭제: 관리자만)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. announcements 스토리지 버킷 생성
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'announcements'
  ) THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'announcements',
      'announcements',
      true, -- Public: true (모든 인증 사용자가 읽기 가능)
      52428800, -- 50MB 파일 크기 제한
      ARRAY[
        'image/*', -- 이미지 파일
        'application/pdf', -- PDF 파일
        'application/msword', -- .doc
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', -- .docx
        'application/vnd.ms-excel', -- .xls
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', -- .xlsx
        'application/vnd.ms-powerpoint', -- .ppt
        'application/vnd.openxmlformats-officedocument.presentationml.presentation', -- .pptx
        'text/plain', -- .txt
        'text/csv', -- .csv
        'application/zip', -- .zip
        'application/x-rar-compressed', -- .rar
        'application/vnd.rar', -- .rar
        'application/x-7z-compressed', -- .7z
        'application/octet-stream' -- 기타 파일
      ]
    );
    
    RAISE NOTICE 'announcements 스토리지 버킷을 생성했습니다.';
  ELSE
    RAISE NOTICE 'announcements 스토리지 버킷이 이미 존재합니다.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. announcements 버킷 RLS 정책 설정
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- 3. RLS 정책 코멘트 추가
-- ----------------------------------------------------------------------------

COMMENT ON POLICY "announcements_storage_select_all" ON storage.objects IS 
'공지사항 스토리지 읽기 정책: 모든 인증 사용자가 announcements 버킷의 파일을 읽을 수 있음';

COMMENT ON POLICY "announcements_storage_insert_admin" ON storage.objects IS 
'공지사항 스토리지 업로드 정책: 관리자만 announcements 버킷에 파일을 업로드할 수 있음';

COMMENT ON POLICY "announcements_storage_update_admin" ON storage.objects IS 
'공지사항 스토리지 수정 정책: 관리자만 announcements 버킷의 파일을 수정할 수 있음';

COMMENT ON POLICY "announcements_storage_delete_admin" ON storage.objects IS 
'공지사항 스토리지 삭제 정책: 관리자만 announcements 버킷의 파일을 삭제할 수 있음';

COMMIT;
