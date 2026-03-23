-- ============================================================================
-- Phase 1: Task 2-2 - tasks 테이블에서 project_id 제거
-- ============================================================================
-- 목적: project_id 외래키 제거 및 컬럼 제거 (데이터 마이그레이션 완료 후)
-- 
-- 작업 내용:
-- 1. project_id 외래키 제약조건 제거
-- 2. project_id 컬럼 제거
-- 3. project_id 관련 인덱스 제거 (자동으로 제거됨)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. project_id 외래키 제약조건 제거
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'tasks'
      AND constraint_name = 'tasks_project_id_fkey'
  ) THEN
    ALTER TABLE public.tasks
    DROP CONSTRAINT tasks_project_id_fkey;
    
    RAISE NOTICE 'tasks 테이블에서 project_id 외래키 제약조건을 제거했습니다.';
  ELSE
    RAISE NOTICE 'tasks 테이블에 project_id 외래키 제약조건이 존재하지 않습니다.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. project_id 관련 인덱스 제거
-- ----------------------------------------------------------------------------

-- idx_tasks_project_id 인덱스 제거
DROP INDEX IF EXISTS public.idx_tasks_project_id;

-- idx_tasks_project_status 복합 인덱스 제거
DROP INDEX IF EXISTS public.idx_tasks_project_status;

-- ----------------------------------------------------------------------------
-- 3. project_id 컬럼 제거
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tasks'
      AND column_name = 'project_id'
  ) THEN
    ALTER TABLE public.tasks
    DROP COLUMN project_id;
    
    RAISE NOTICE 'tasks 테이블에서 project_id 컬럼을 제거했습니다.';
  ELSE
    RAISE NOTICE 'tasks 테이블에 project_id 컬럼이 존재하지 않습니다.';
  END IF;
END $$;

COMMIT;
