-- ============================================================================
-- Phase 1: 프로젝트 및 Task 테이블 스키마 정합성 확보
-- ============================================================================
-- 목적: @tasks.json 기획 기준에 맞춰 컬럼명 변경 및 추가
-- 
-- 변경 사항:
-- 1. projects.opportunity → projects.title (기회 필드)
-- 2. tasks.instruction → tasks.title (Task 제목)
-- 3. tasks.description 컬럼 추가 (Task 설명)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. projects 테이블: opportunity → title 변경
-- ----------------------------------------------------------------------------

-- opportunity 컬럼이 존재하는지 확인 후 rename
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'projects' 
      AND column_name = 'opportunity'
  ) THEN
    ALTER TABLE public.projects 
    RENAME COLUMN opportunity TO title;
    
    RAISE NOTICE 'projects.opportunity 컬럼을 title로 변경했습니다.';
  ELSE
    RAISE NOTICE 'projects.opportunity 컬럼이 존재하지 않습니다. 스킵합니다.';
  END IF;
END $$;

-- title 컬럼이 없으면 추가 (opportunity가 없었던 경우)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'projects' 
      AND column_name = 'title'
  ) THEN
    ALTER TABLE public.projects 
    ADD COLUMN title TEXT NOT NULL DEFAULT '';
    
    RAISE NOTICE 'projects.title 컬럼을 추가했습니다.';
  END IF;
END $$;

-- title 컬럼에 NOT NULL 제약조건 추가 (없는 경우)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'projects' 
      AND column_name = 'title'
      AND is_nullable = 'YES'
  ) THEN
    -- 기존 NULL 값을 빈 문자열로 변경
    UPDATE public.projects 
    SET title = '' 
    WHERE title IS NULL;
    
    -- NOT NULL 제약조건 추가
    ALTER TABLE public.projects 
    ALTER COLUMN title SET NOT NULL;
    
    RAISE NOTICE 'projects.title 컬럼에 NOT NULL 제약조건을 추가했습니다.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. tasks 테이블: instruction → title 변경
-- ----------------------------------------------------------------------------

-- instruction 컬럼이 존재하는지 확인 후 rename
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'tasks' 
      AND column_name = 'instruction'
  ) THEN
    ALTER TABLE public.tasks 
    RENAME COLUMN instruction TO title;
    
    RAISE NOTICE 'tasks.instruction 컬럼을 title로 변경했습니다.';
  ELSE
    RAISE NOTICE 'tasks.instruction 컬럼이 존재하지 않습니다. 스킵합니다.';
  END IF;
END $$;

-- title 컬럼이 없으면 추가 (instruction이 없었던 경우)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'tasks' 
      AND column_name = 'title'
  ) THEN
    ALTER TABLE public.tasks 
    ADD COLUMN title TEXT NOT NULL DEFAULT '';
    
    RAISE NOTICE 'tasks.title 컬럼을 추가했습니다.';
  END IF;
END $$;

-- title 컬럼에 NOT NULL 제약조건 추가 (없는 경우)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'tasks' 
      AND column_name = 'title'
      AND is_nullable = 'YES'
  ) THEN
    -- 기존 NULL 값을 빈 문자열로 변경
    UPDATE public.tasks 
    SET title = '' 
    WHERE title IS NULL;
    
    -- NOT NULL 제약조건 추가
    ALTER TABLE public.tasks 
    ALTER COLUMN title SET NOT NULL;
    
    RAISE NOTICE 'tasks.title 컬럼에 NOT NULL 제약조건을 추가했습니다.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. tasks 테이블: description 컬럼 추가
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'tasks' 
      AND column_name = 'description'
  ) THEN
    ALTER TABLE public.tasks 
    ADD COLUMN description TEXT;
    
    RAISE NOTICE 'tasks.description 컬럼을 추가했습니다.';
  ELSE
    RAISE NOTICE 'tasks.description 컬럼이 이미 존재합니다. 스킵합니다.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. 불필요한 컬럼 제거 (기획에 없는 필드)
-- ----------------------------------------------------------------------------

-- projects.patent_name 제거 (기획에 없음)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'projects' 
      AND column_name = 'patent_name'
  ) THEN
    ALTER TABLE public.projects 
    DROP COLUMN patent_name;
    
    RAISE NOTICE 'projects.patent_name 컬럼을 제거했습니다.';
  END IF;
END $$;

-- projects.is_public 제거 (기획에 없음)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'projects' 
      AND column_name = 'is_public'
  ) THEN
    ALTER TABLE public.projects 
    DROP COLUMN is_public;
    
    RAISE NOTICE 'projects.is_public 컬럼을 제거했습니다.';
  END IF;
END $$;

-- projects.status 제거 (기획에 없음, project_status enum도 없음)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'projects' 
      AND column_name = 'status'
  ) THEN
    ALTER TABLE public.projects 
    DROP COLUMN status;
    
    RAISE NOTICE 'projects.status 컬럼을 제거했습니다.';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- 검증 쿼리 (수동 실행)
-- ============================================================================
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
--   AND table_name IN ('projects', 'tasks')
-- ORDER BY table_name, ordinal_position;


