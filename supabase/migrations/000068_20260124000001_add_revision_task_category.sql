-- ============================================================================
-- Task 카테고리 "수정(REVISION)" 추가 마이그레이션
-- ============================================================================
-- 목적: task_category ENUM 타입에 REVISION 값을 추가하여 "수정" 카테고리 지원
-- 
-- 작업 내용:
-- 1. task_category ENUM 타입에 'REVISION' 값 추가 (REVIEW 다음에 위치)
-- 2. ENUM 타입 주석 업데이트
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. task_category ENUM 타입에 REVISION 값 추가
-- ----------------------------------------------------------------------------

-- ENUM 타입이 존재하는지 확인 후 값 추가
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type 
    WHERE typname = 'task_category'
  ) THEN
    -- REVISION 값이 이미 존재하는지 확인
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum 
      WHERE enumlabel = 'REVISION' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'task_category')
    ) THEN
      -- REVIEW 다음에 REVISION 값 추가
      ALTER TYPE task_category ADD VALUE 'REVISION' AFTER 'REVIEW';
      
      RAISE NOTICE 'task_category ENUM 타입에 REVISION 값을 추가했습니다.';
    ELSE
      RAISE NOTICE 'task_category ENUM 타입에 REVISION 값이 이미 존재합니다.';
    END IF;
  ELSE
    RAISE EXCEPTION 'task_category ENUM 타입이 존재하지 않습니다.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. ENUM 타입 주석 업데이트
-- ----------------------------------------------------------------------------

COMMENT ON TYPE task_category IS 'Task 카테고리: REVIEW(검토), REVISION(수정), CONTRACT(계약), SPECIFICATION(명세서), APPLICATION(출원)';

COMMIT;

-- ============================================================================
-- 검증 쿼리 (수동 실행)
-- ============================================================================
-- ENUM 값 확인:
-- SELECT enumlabel FROM pg_enum 
-- WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'task_category') 
-- ORDER BY enumsortorder;
--
-- 예상 결과:
-- REVIEW
-- REVISION  <- 새로 추가됨
-- CONTRACT
-- SPECIFICATION
-- APPLICATION
