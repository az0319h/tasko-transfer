-- ============================================================================
-- Phase 1: Task 2-1 - tasks 테이블 컬럼 추가
-- ============================================================================
-- 목적: tasks 테이블에 created_by, client_name, send_email_to_client 컬럼 추가
-- 
-- 작업 내용:
-- 1. created_by UUID 컬럼 추가 (auth.users 참조)
-- 2. client_name TEXT 컬럼 추가
-- 3. send_email_to_client BOOLEAN NOT NULL DEFAULT false 컬럼 추가
-- 4. created_by 외래키 제약조건 추가
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. created_by 컬럼 추가
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tasks'
      AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.tasks
    ADD COLUMN created_by UUID;
    
    RAISE NOTICE 'tasks 테이블에 created_by 컬럼을 추가했습니다.';
  ELSE
    RAISE NOTICE 'tasks 테이블에 created_by 컬럼이 이미 존재합니다.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. client_name 컬럼 추가
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tasks'
      AND column_name = 'client_name'
  ) THEN
    ALTER TABLE public.tasks
    ADD COLUMN client_name TEXT;
    
    RAISE NOTICE 'tasks 테이블에 client_name 컬럼을 추가했습니다.';
  ELSE
    RAISE NOTICE 'tasks 테이블에 client_name 컬럼이 이미 존재합니다.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. send_email_to_client 컬럼 추가
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tasks'
      AND column_name = 'send_email_to_client'
  ) THEN
    ALTER TABLE public.tasks
    ADD COLUMN send_email_to_client BOOLEAN NOT NULL DEFAULT false;
    
    RAISE NOTICE 'tasks 테이블에 send_email_to_client 컬럼을 추가했습니다.';
  ELSE
    RAISE NOTICE 'tasks 테이블에 send_email_to_client 컬럼이 이미 존재합니다.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. created_by 외래키 제약조건 추가
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'tasks'
      AND constraint_name = 'tasks_created_by_fkey'
  ) THEN
    ALTER TABLE public.tasks
    ADD CONSTRAINT tasks_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES auth.users(id)
    ON DELETE RESTRICT;
    
    RAISE NOTICE 'tasks 테이블에 created_by 외래키 제약조건을 추가했습니다.';
  ELSE
    RAISE NOTICE 'tasks 테이블에 created_by 외래키 제약조건이 이미 존재합니다.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. 컬럼 코멘트 추가
-- ----------------------------------------------------------------------------

COMMENT ON COLUMN public.tasks.created_by IS '태스크를 생성한 사용자 ID (auth.users 참조)';
COMMENT ON COLUMN public.tasks.client_name IS '고객명 (프로젝트에서 마이그레이션됨)';
COMMENT ON COLUMN public.tasks.send_email_to_client IS '고객에게 이메일 발송 완료 여부 (승인 상태일 때만 사용)';

COMMIT;
