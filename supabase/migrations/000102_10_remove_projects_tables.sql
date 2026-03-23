-- ============================================================================
-- Phase 1: Task 10-6 - 프로젝트 테이블 제거
-- ============================================================================
-- 목적: 모든 작업 완료 및 검증 후 projects, project_participants 테이블 제거
-- 
-- 작업 내용:
-- 1. 프로젝트 관련 정책 제거 (테이블이 존재하는 경우에만)
-- 2. 프로젝트 관련 함수 제거
-- 3. 프로젝트 테이블 제거 (CASCADE로 관련 인덱스, 트리거도 자동 제거)
-- 
-- ⚠️ 중요: 모든 작업이 완료되고 검증된 후에만 실행해야 합니다.
-- 테스트 환경에서 먼저 실행하여 검증한 후 원본 DB에 적용하세요.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. 프로젝트 관련 정책 제거 (테이블이 존재하는 경우에만)
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  -- projects 테이블이 존재하는 경우에만 정책 제거
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'projects'
  ) THEN
    DROP POLICY IF EXISTS "projects_select_admin_or_participant" ON public.projects;
    DROP POLICY IF EXISTS "projects_insert_admin_only" ON public.projects;
    DROP POLICY IF EXISTS "projects_update_admin_only" ON public.projects;
    DROP POLICY IF EXISTS "projects_delete_admin_only" ON public.projects;
    RAISE NOTICE 'projects 테이블의 정책을 제거했습니다.';
  ELSE
    RAISE NOTICE 'projects 테이블이 존재하지 않아 정책 제거를 스킵합니다.';
  END IF;

  -- project_participants 테이블이 존재하는 경우에만 정책 제거
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'project_participants'
  ) THEN
    DROP POLICY IF EXISTS "project_participants_select_participant_or_admin" ON public.project_participants;
    DROP POLICY IF EXISTS "project_participants_insert_admin_only" ON public.project_participants;
    DROP POLICY IF EXISTS "project_participants_delete_admin_only" ON public.project_participants;
    RAISE NOTICE 'project_participants 테이블의 정책을 제거했습니다.';
  ELSE
    RAISE NOTICE 'project_participants 테이블이 존재하지 않아 정책 제거를 스킵합니다.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. 프로젝트 관련 함수 제거 (정책 제거 후 가능)
-- ----------------------------------------------------------------------------

-- is_project_participant 함수 제거
DROP FUNCTION IF EXISTS public.is_project_participant(uuid, uuid);

-- 기타 프로젝트 관련 함수들도 제거 (이미 04_functions_triggers.sql에서 제거되었을 수 있음)
DROP FUNCTION IF EXISTS public.create_project_with_participants(text, text, timestamp with time zone, uuid[]);
DROP FUNCTION IF EXISTS public.get_project_summaries();
DROP FUNCTION IF EXISTS public.has_project_access(uuid, uuid);
DROP FUNCTION IF EXISTS public.has_task_in_project(UUID, UUID);

-- ----------------------------------------------------------------------------
-- 3. 프로젝트 테이블 제거 (최종 단계)
-- ----------------------------------------------------------------------------

-- project_participants 테이블 제거 (CASCADE로 관련 인덱스도 자동 제거)
DROP TABLE IF EXISTS public.project_participants CASCADE;

-- projects 테이블 제거 (CASCADE로 관련 인덱스, 트리거도 자동 제거)
DROP TABLE IF EXISTS public.projects CASCADE;

-- ----------------------------------------------------------------------------
-- 4. 코멘트 추가
-- ----------------------------------------------------------------------------

-- 작업 완료 로그
DO $$
BEGIN
  RAISE NOTICE '프로젝트 테이블 제거 작업을 완료했습니다.';
  RAISE NOTICE '제거된 테이블: projects, project_participants';
  RAISE NOTICE 'CASCADE로 관련 인덱스, 트리거, 외래키도 자동으로 제거되었습니다.';
END $$;

COMMIT;
