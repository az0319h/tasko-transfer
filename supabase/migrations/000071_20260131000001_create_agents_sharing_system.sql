-- ============================================================================
-- 에이전트 공유 시스템 마이그레이션
-- ============================================================================
-- 목적: 관리자 멤버가 자신이 만든 에이전트를 공유할 수 있는 시스템 구축
-- 
-- 작업 내용:
-- 1. agents 테이블 생성 (에이전트 기본 정보)
-- 2. RLS 정책 설정
-- 3. 인덱스 및 트리거 설정
-- 4. Realtime 구독 활성화
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. agents 테이블 생성
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
COMMENT ON TABLE public.agents IS '에이전트 공유 테이블: 관리자가 만든 에이전트 정보';
COMMENT ON COLUMN public.agents.name IS '에이전트 이름';
COMMENT ON COLUMN public.agents.description IS '에이전트 간략한 설명 (목록 페이지용)';
COMMENT ON COLUMN public.agents.detailed_description IS '에이전트 구체적인 설명 (상세 페이지용, 긴 설명)';
COMMENT ON COLUMN public.agents.features IS '에이전트 특징 리스트 (JSON 배열)';
COMMENT ON COLUMN public.agents.site_media_url IS '사이트 대표 미디어 URL (이미지 또는 비디오, Storage 버킷 경로)';
COMMENT ON COLUMN public.agents.site_media_type IS '대표 미디어 타입: image(이미지) 또는 video(비디오)';
COMMENT ON COLUMN public.agents.site_url IS '에이전트 사이트 URL (에이전트 확인하기 버튼용)';
COMMENT ON COLUMN public.agents.created_by IS '에이전트 생성자 ID';

-- ----------------------------------------------------------------------------
-- 2. RLS 활성화
-- ----------------------------------------------------------------------------

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 3. agents 테이블 RLS 정책
-- ----------------------------------------------------------------------------

-- SELECT: 모든 관리자가 모든 에이전트 조회 가능
CREATE POLICY "agents_select_admin_all"
ON public.agents
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- INSERT: 모든 관리자가 에이전트 생성 가능 (created_by는 자신의 ID로만 설정 가능)
CREATE POLICY "agents_insert_admin"
ON public.agents
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
  AND created_by = auth.uid()
);

-- UPDATE: 자신이 생성한 에이전트만 수정 가능
CREATE POLICY "agents_update_own"
ON public.agents
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
  AND created_by = auth.uid()
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
  AND created_by = auth.uid()
);

-- DELETE: 자신이 생성한 에이전트만 삭제 가능
CREATE POLICY "agents_delete_own"
ON public.agents
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
  AND created_by = auth.uid()
);

-- ----------------------------------------------------------------------------
-- 4. Realtime 구독 활성화
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
