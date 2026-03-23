-- ============================================================================
-- Phase 1: Task 6-1 - 공지사항 테이블 생성 및 RLS 정책
-- ============================================================================
-- 목적: announcements, announcement_dismissals, announcement_attachments 테이블 생성
-- 
-- 작업 내용:
-- 1. announcements 테이블 생성 (제목, 내용, 이미지, 작성자, 활성 여부, 게시 종료 날짜)
-- 2. announcement_dismissals 테이블 생성 (사용자별 "다시 보지 않음" 기록)
-- 3. announcement_attachments 테이블 생성 (파일 첨부)
-- 4. 인덱스 생성 (성능 최적화)
-- 5. RLS 활성화 및 정책 설정
-- 6. updated_at 자동 업데이트 트리거 설정
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. announcements 테이블 생성
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'announcements'
  ) THEN
    CREATE TABLE public.announcements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      image_url TEXT,
      created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    
    RAISE NOTICE 'announcements 테이블을 생성했습니다.';
  ELSE
    RAISE NOTICE 'announcements 테이블이 이미 존재합니다.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. announcement_dismissals 테이블 생성
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'announcement_dismissals'
  ) THEN
    CREATE TABLE public.announcement_dismissals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      dismissed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(announcement_id, user_id)
    );
    
    RAISE NOTICE 'announcement_dismissals 테이블을 생성했습니다.';
  ELSE
    RAISE NOTICE 'announcement_dismissals 테이블이 이미 존재합니다.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. announcement_attachments 테이블 생성
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'announcement_attachments'
  ) THEN
    CREATE TABLE public.announcement_attachments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      file_url TEXT NOT NULL,
      file_size BIGINT,
      file_type TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    
    RAISE NOTICE 'announcement_attachments 테이블을 생성했습니다.';
  ELSE
    RAISE NOTICE 'announcement_attachments 테이블이 이미 존재합니다.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. 인덱스 생성
-- ----------------------------------------------------------------------------

-- announcements 테이블 인덱스
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'announcements'
      AND indexname = 'idx_announcements_is_active'
  ) THEN
    CREATE INDEX idx_announcements_is_active 
    ON public.announcements(is_active) 
    WHERE is_active = true;
    
    RAISE NOTICE 'idx_announcements_is_active 인덱스를 생성했습니다.';
  ELSE
    RAISE NOTICE 'idx_announcements_is_active 인덱스가 이미 존재합니다.';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'announcements'
      AND indexname = 'idx_announcements_created_at'
  ) THEN
    CREATE INDEX idx_announcements_created_at 
    ON public.announcements(created_at DESC);
    
    RAISE NOTICE 'idx_announcements_created_at 인덱스를 생성했습니다.';
  ELSE
    RAISE NOTICE 'idx_announcements_created_at 인덱스가 이미 존재합니다.';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'announcements'
      AND indexname = 'idx_announcements_expires_at'
  ) THEN
    CREATE INDEX idx_announcements_expires_at 
    ON public.announcements(expires_at) 
    WHERE expires_at IS NOT NULL;
    
    RAISE NOTICE 'idx_announcements_expires_at 인덱스를 생성했습니다.';
  ELSE
    RAISE NOTICE 'idx_announcements_expires_at 인덱스가 이미 존재합니다.';
  END IF;
END $$;

-- announcement_dismissals 테이블 인덱스
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'announcement_dismissals'
      AND indexname = 'idx_announcement_dismissals_announcement_user'
  ) THEN
    CREATE INDEX idx_announcement_dismissals_announcement_user 
    ON public.announcement_dismissals(announcement_id, user_id);
    
    RAISE NOTICE 'idx_announcement_dismissals_announcement_user 인덱스를 생성했습니다.';
  ELSE
    RAISE NOTICE 'idx_announcement_dismissals_announcement_user 인덱스가 이미 존재합니다.';
  END IF;
END $$;

-- announcement_attachments 테이블 인덱스
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'announcement_attachments'
      AND indexname = 'idx_announcement_attachments_announcement_id'
  ) THEN
    CREATE INDEX idx_announcement_attachments_announcement_id 
    ON public.announcement_attachments(announcement_id);
    
    RAISE NOTICE 'idx_announcement_attachments_announcement_id 인덱스를 생성했습니다.';
  ELSE
    RAISE NOTICE 'idx_announcement_attachments_announcement_id 인덱스가 이미 존재합니다.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. RLS 활성화
-- ----------------------------------------------------------------------------

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_dismissals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_attachments ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 6. announcements 테이블 RLS 정책
-- ----------------------------------------------------------------------------

-- SELECT 정책: 활성 공지사항은 모든 인증 사용자 조회 가능, 관리자는 모든 공지사항 조회 가능
DROP POLICY IF EXISTS "announcements_select_active" ON public.announcements;
CREATE POLICY "announcements_select_active"
ON public.announcements
FOR SELECT
USING (
  (is_active = true AND (expires_at IS NULL OR expires_at > NOW()))
  OR is_admin(auth.uid())
);

-- INSERT 정책: 관리자만 생성 가능
DROP POLICY IF EXISTS "announcements_insert_admin" ON public.announcements;
CREATE POLICY "announcements_insert_admin"
ON public.announcements
FOR INSERT
WITH CHECK (is_admin(auth.uid()));

-- UPDATE 정책: 관리자만 수정 가능
DROP POLICY IF EXISTS "announcements_update_admin" ON public.announcements;
CREATE POLICY "announcements_update_admin"
ON public.announcements
FOR UPDATE
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- DELETE 정책: 관리자만 삭제 가능
DROP POLICY IF EXISTS "announcements_delete_admin" ON public.announcements;
CREATE POLICY "announcements_delete_admin"
ON public.announcements
FOR DELETE
USING (is_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- 7. announcement_dismissals 테이블 RLS 정책
-- ----------------------------------------------------------------------------

-- SELECT 정책: 자신의 레코드만 조회 가능
DROP POLICY IF EXISTS "announcement_dismissals_select_own" ON public.announcement_dismissals;
CREATE POLICY "announcement_dismissals_select_own"
ON public.announcement_dismissals
FOR SELECT
USING (auth.uid() = user_id);

-- INSERT 정책: 자신의 레코드만 생성 가능
DROP POLICY IF EXISTS "announcement_dismissals_insert_own" ON public.announcement_dismissals;
CREATE POLICY "announcement_dismissals_insert_own"
ON public.announcement_dismissals
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 8. announcement_attachments 테이블 RLS 정책
-- ----------------------------------------------------------------------------

-- SELECT 정책: 인증된 사용자는 모두 조회 가능
DROP POLICY IF EXISTS "announcement_attachments_select_all" ON public.announcement_attachments;
CREATE POLICY "announcement_attachments_select_all"
ON public.announcement_attachments
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- INSERT 정책: 관리자만 생성 가능
DROP POLICY IF EXISTS "announcement_attachments_insert_admin" ON public.announcement_attachments;
CREATE POLICY "announcement_attachments_insert_admin"
ON public.announcement_attachments
FOR INSERT
WITH CHECK (is_admin(auth.uid()));

-- UPDATE 정책: 관리자만 수정 가능
DROP POLICY IF EXISTS "announcement_attachments_update_admin" ON public.announcement_attachments;
CREATE POLICY "announcement_attachments_update_admin"
ON public.announcement_attachments
FOR UPDATE
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- DELETE 정책: 관리자만 삭제 가능
DROP POLICY IF EXISTS "announcement_attachments_delete_admin" ON public.announcement_attachments;
CREATE POLICY "announcement_attachments_delete_admin"
ON public.announcement_attachments
FOR DELETE
USING (is_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- 9. updated_at 자동 업데이트 트리거
-- ----------------------------------------------------------------------------

-- announcements 테이블의 updated_at 트리거
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_announcements_updated_at'
  ) THEN
    CREATE TRIGGER update_announcements_updated_at
    BEFORE UPDATE ON public.announcements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
    
    RAISE NOTICE 'announcements 테이블의 updated_at 트리거를 생성했습니다.';
  ELSE
    RAISE NOTICE 'announcements 테이블의 updated_at 트리거가 이미 존재합니다.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 10. 테이블 및 컬럼 코멘트 추가
-- ----------------------------------------------------------------------------

COMMENT ON TABLE public.announcements IS '공지사항 테이블: 관리자가 작성한 공지사항 정보';
COMMENT ON COLUMN public.announcements.title IS '공지사항 제목';
COMMENT ON COLUMN public.announcements.content IS '공지사항 내용';
COMMENT ON COLUMN public.announcements.image_url IS '공지사항 최상단 이미지 URL (선택사항)';
COMMENT ON COLUMN public.announcements.created_by IS '공지사항 작성자 ID (auth.users 참조)';
COMMENT ON COLUMN public.announcements.is_active IS '공지사항 활성 여부 (true: 활성, false: 비활성)';
COMMENT ON COLUMN public.announcements.expires_at IS '공지사항 게시 종료 날짜 (NULL이면 무기한)';

COMMENT ON TABLE public.announcement_dismissals IS '공지사항 "다시 보지 않음" 기록 테이블: 사용자가 특정 공지사항을 다시 보지 않기로 선택한 기록';
COMMENT ON COLUMN public.announcement_dismissals.announcement_id IS '공지사항 ID';
COMMENT ON COLUMN public.announcement_dismissals.user_id IS '사용자 ID (auth.users 참조)';
COMMENT ON COLUMN public.announcement_dismissals.dismissed_at IS '다시 보지 않기로 선택한 시간';

COMMENT ON TABLE public.announcement_attachments IS '공지사항 파일 첨부 테이블: 공지사항에 첨부된 파일 정보';
COMMENT ON COLUMN public.announcement_attachments.announcement_id IS '공지사항 ID';
COMMENT ON COLUMN public.announcement_attachments.file_name IS '파일명';
COMMENT ON COLUMN public.announcement_attachments.file_url IS '파일 URL (Storage 버킷 경로)';
COMMENT ON COLUMN public.announcement_attachments.file_size IS '파일 크기 (bytes)';
COMMENT ON COLUMN public.announcement_attachments.file_type IS '파일 타입 (MIME type)';

-- ----------------------------------------------------------------------------
-- 11. RLS 정책 코멘트 추가
-- ----------------------------------------------------------------------------

COMMENT ON POLICY "announcements_select_active" ON public.announcements IS 
'공지사항 조회 정책: 활성 공지사항은 모든 인증 사용자 조회 가능, 관리자는 모든 공지사항 조회 가능';

COMMENT ON POLICY "announcements_insert_admin" ON public.announcements IS 
'공지사항 생성 정책: 관리자만 공지사항 생성 가능';

COMMENT ON POLICY "announcements_update_admin" ON public.announcements IS 
'공지사항 수정 정책: 관리자만 공지사항 수정 가능';

COMMENT ON POLICY "announcements_delete_admin" ON public.announcements IS 
'공지사항 삭제 정책: 관리자만 공지사항 삭제 가능';

COMMENT ON POLICY "announcement_dismissals_select_own" ON public.announcement_dismissals IS 
'공지사항 "다시 보지 않음" 조회 정책: 자신의 레코드만 조회 가능';

COMMENT ON POLICY "announcement_dismissals_insert_own" ON public.announcement_dismissals IS 
'공지사항 "다시 보지 않음" 생성 정책: 자신의 레코드만 생성 가능';

COMMENT ON POLICY "announcement_attachments_select_all" ON public.announcement_attachments IS 
'공지사항 첨부파일 조회 정책: 인증된 사용자는 모두 조회 가능';

COMMENT ON POLICY "announcement_attachments_insert_admin" ON public.announcement_attachments IS 
'공지사항 첨부파일 생성 정책: 관리자만 생성 가능';

COMMENT ON POLICY "announcement_attachments_update_admin" ON public.announcement_attachments IS 
'공지사항 첨부파일 수정 정책: 관리자만 수정 가능';

COMMENT ON POLICY "announcement_attachments_delete_admin" ON public.announcement_attachments IS 
'공지사항 첨부파일 삭제 정책: 관리자만 삭제 가능';

COMMIT;
