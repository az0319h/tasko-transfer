-- ============================================================================
-- agents Storage 버킷 생성 마이그레이션
-- ============================================================================
-- 목적: agents Storage 버킷 생성
-- 
-- 버킷 설정:
-- - 버킷 이름: agents
-- - Public: true (미디어 공개 접근)
-- - File size limit: 100MB (비디오 파일 지원을 위해 증가)
-- - Allowed MIME types: image/*, video/*
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- agents Storage 버킷 생성
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'agents'
  ) THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'agents',
      'agents',
      true, -- Public: true (미디어 공개 접근)
      104857600, -- 100MB 파일 크기 제한 (비디오 파일 지원)
      ARRAY[
        'image/*', -- 이미지 파일 (jpg, png, gif, webp 등)
        'video/*'  -- 비디오 파일 (mp4, webm, mov 등)
      ]
    );
    
    RAISE NOTICE 'agents 스토리지 버킷을 생성했습니다.';
  ELSE
    RAISE NOTICE 'agents 스토리지 버킷이 이미 존재합니다.';
  END IF;
END $$;

COMMIT;
