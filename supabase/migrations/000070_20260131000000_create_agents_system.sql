-- ============================================================================
-- 에이전트 공유 시스템 통합 마이그레이션
-- ============================================================================
-- 목적: 모든 인증된 사용자가 에이전트를 생성/조회하고 자신이 만든 에이전트를 관리할 수 있는 시스템 구축
-- 
-- 작업 내용:
-- 1. agents Storage 버킷 생성
-- 2. agents 테이블 생성 (에이전트 기본 정보)
-- 3. RLS 정책 설정 (모든 인증된 사용자 접근 가능)
-- 4. Storage RLS 정책 설정 (모든 인증된 사용자 접근 가능)
-- 5. 인덱스 및 트리거 설정
-- 6. Realtime 구독 활성화
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. agents Storage 버킷 생성
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

-- ----------------------------------------------------------------------------
-- 2. agents 테이블 생성
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  detailed_description TEXT,
  features JSONB DEFAULT '[]'::jsonb,
  site_media_url TEXT,
  site_media_type TEXT CHECK (site_media_type IN ('image', 'video')),
  site_url TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_agents_created_by ON public.agents(created_by);
CREATE INDEX IF NOT EXISTS idx_agents_created_at ON public.agents(created_at DESC);

-- updated_at 자동 업데이트 트리거
DROP TRIGGER IF EXISTS update_agents_updated_at ON public.agents;
CREATE TRIGGER update_agents_updated_at
  BEFORE UPDATE ON public.agents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 코멘트 추가
COMMENT ON TABLE public.agents IS '에이전트 공유 테이블: 모든 인증된 사용자가 만든 에이전트 정보';
COMMENT ON COLUMN public.agents.name IS '에이전트 이름';
COMMENT ON COLUMN public.agents.description IS '에이전트 간략한 설명 (목록 페이지용)';
COMMENT ON COLUMN public.agents.detailed_description IS '에이전트 구체적인 설명 (상세 페이지용, 긴 설명)';
COMMENT ON COLUMN public.agents.features IS '에이전트 특징 리스트 (JSON 배열)';
COMMENT ON COLUMN public.agents.site_media_url IS '사이트 대표 미디어 URL (이미지 또는 비디오, Storage 버킷 경로)';
COMMENT ON COLUMN public.agents.site_media_type IS '대표 미디어 타입: image(이미지) 또는 video(비디오)';
COMMENT ON COLUMN public.agents.site_url IS '에이전트 사이트 URL (에이전트 확인하기 버튼용)';
COMMENT ON COLUMN public.agents.created_by IS '에이전트 생성자 ID';

-- ----------------------------------------------------------------------------
-- 3. RLS 활성화
-- ----------------------------------------------------------------------------

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 4. agents 테이블 RLS 정책 (모든 인증된 사용자 접근 가능)
-- ----------------------------------------------------------------------------

-- SELECT: 모든 인증된 사용자가 모든 에이전트 조회 가능
CREATE POLICY "agents_select_all"
ON public.agents
FOR SELECT
TO authenticated
USING (true);

-- INSERT: 모든 인증된 사용자가 에이전트 생성 가능 (created_by는 자신의 ID로만 설정 가능)
CREATE POLICY "agents_insert_all"
ON public.agents
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
);

-- UPDATE: 자신이 생성한 에이전트만 수정 가능
CREATE POLICY "agents_update_own"
ON public.agents
FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- DELETE: 자신이 생성한 에이전트만 삭제 가능
CREATE POLICY "agents_delete_own"
ON public.agents
FOR DELETE
TO authenticated
USING (created_by = auth.uid());

-- ----------------------------------------------------------------------------
-- 5. agents Storage 버킷 RLS 정책 (모든 인증된 사용자 접근 가능)
-- ----------------------------------------------------------------------------

-- 기존 정책 삭제 (있는 경우)
DROP POLICY IF EXISTS "agents_storage_select_admin" ON storage.objects;
DROP POLICY IF EXISTS "agents_storage_insert_admin" ON storage.objects;
DROP POLICY IF EXISTS "agents_storage_select_all" ON storage.objects;
DROP POLICY IF EXISTS "agents_storage_insert_all" ON storage.objects;
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

  RAISE NOTICE 'agents 버킷의 Storage RLS 정책이 성공적으로 생성되었습니다.';
EXCEPTION
  WHEN insufficient_privilege OR OTHERS THEN
    RAISE WARNING 'Storage RLS 정책 생성 실패: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    RAISE WARNING 'agents 버킷의 Storage RLS 정책을 Supabase Dashboard에서 수동으로 설정해야 합니다.';
END $$;

-- ----------------------------------------------------------------------------
-- 6. Realtime 구독 활성화
-- ----------------------------------------------------------------------------

-- Realtime을 활성화하여 에이전트 목록이 실시간으로 업데이트되도록 설정
DO $$
BEGIN
  -- agents 테이블 Realtime 활성화
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'agents'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.agents;
    RAISE NOTICE 'agents 테이블에 Realtime을 활성화했습니다.';
  ELSE
    RAISE NOTICE 'agents 테이블의 Realtime이 이미 활성화되어 있습니다.';
  END IF;
END $$;

COMMIT;
