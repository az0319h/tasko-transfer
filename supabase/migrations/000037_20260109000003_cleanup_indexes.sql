-- ============================================================================
-- Phase 3: 인덱스 정리 (선택적)
-- ============================================================================
-- 목적: 사용되지 않는 인덱스 및 중복 인덱스 제거
-- 주의: 실제 사용 여부를 확인한 후 제거 결정 필요
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 중복 인덱스 제거 (확실한 경우만)
-- ----------------------------------------------------------------------------

-- profiles.role 중복 인덱스 제거
-- idx_profiles_role와 profiles_role_idx 중 하나만 유지
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND tablename = 'profiles' 
      AND indexname = 'profiles_role_idx'
  ) AND EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND tablename = 'profiles' 
      AND indexname = 'idx_profiles_role'
  ) THEN
    -- profiles_role_idx 제거 (idx_profiles_role 유지)
    DROP INDEX IF EXISTS public.profiles_role_idx;
    RAISE NOTICE 'profiles_role_idx 중복 인덱스를 제거했습니다.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 사용되지 않는 인덱스 제거 (선택적 - 주석 처리)
-- ----------------------------------------------------------------------------
-- 주의: 실제 쿼리 패턴을 분석한 후 제거 결정 필요
-- 아래 인덱스들은 현재 사용되지 않지만, 향후 쿼리 최적화에 필요할 수 있음

-- project_participants 인덱스 (사용되지 않음으로 표시됨)
-- DROP INDEX IF EXISTS public.idx_project_participants_user_id;
-- DROP INDEX IF EXISTS public.idx_project_participants_invited_by;

-- tasks 인덱스 (사용되지 않음으로 표시됨)
-- DROP INDEX IF EXISTS public.idx_tasks_project_id;
-- DROP INDEX IF EXISTS public.idx_tasks_task_status;
-- DROP INDEX IF EXISTS public.idx_tasks_task_category;
-- DROP INDEX IF EXISTS public.idx_tasks_due_date;

-- profiles 인덱스 (사용되지 않음으로 표시됨)
-- DROP INDEX IF EXISTS public.profiles_email_idx;
-- DROP INDEX IF EXISTS public.profiles_is_active_idx;

-- projects 인덱스 (사용되지 않음으로 표시됨)
-- DROP INDEX IF EXISTS public.idx_projects_created_by;
-- DROP INDEX IF EXISTS public.idx_projects_due_date;

-- messages 인덱스 (사용되지 않음으로 표시됨)
-- DROP INDEX IF EXISTS public.idx_messages_task_id;
-- DROP INDEX IF EXISTS public.idx_messages_user_id;
-- DROP INDEX IF EXISTS public.idx_messages_created_at;
-- DROP INDEX IF EXISTS public.idx_messages_task_created;
-- DROP INDEX IF EXISTS public.idx_messages_message_type;
-- DROP INDEX IF EXISTS public.idx_messages_deleted_at;

-- email_logs 인덱스 (사용되지 않음으로 표시됨)
-- DROP INDEX IF EXISTS public.idx_email_logs_task_id;
-- DROP INDEX IF EXISTS public.idx_email_logs_status;
-- DROP INDEX IF EXISTS public.idx_email_logs_created_at;

COMMIT;

-- ============================================================================
-- 검증 쿼리 (수동 실행)
-- ============================================================================
-- SELECT 
--   schemaname,
--   tablename,
--   indexname,
--   indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND tablename IN ('profiles', 'projects', 'tasks', 'messages', 'project_participants', 'email_logs')
-- ORDER BY tablename, indexname;


