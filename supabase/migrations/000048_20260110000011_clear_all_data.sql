-- ============================================================================
-- 모든 테이블 데이터 삭제 (목 데이터 정리)
-- ============================================================================
-- 목적: 모든 테이블의 데이터를 삭제하되, 스키마와 정책(RLS)은 유지
-- 
-- 주의사항:
-- - 스키마, 정책, 함수, 트리거 등은 모두 유지됨
-- - 외래키 제약조건을 고려하여 순서대로 삭제
-- - profiles는 auth.users와 연결되어 있으므로 주의 필요
-- ============================================================================

BEGIN;

-- 외래키 제약조건을 고려하여 역순으로 삭제
-- 1. email_logs (tasks 참조)
TRUNCATE TABLE public.email_logs CASCADE;

-- 2. messages (tasks 참조)
TRUNCATE TABLE public.messages CASCADE;

-- 3. tasks (projects, profiles 참조)
TRUNCATE TABLE public.tasks CASCADE;

-- 4. project_participants (projects, profiles 참조)
TRUNCATE TABLE public.project_participants CASCADE;

-- 5. projects (profiles 참조)
TRUNCATE TABLE public.projects CASCADE;

-- 6. profiles (auth.users 참조)
-- 주의: profiles는 auth.users와 연결되어 있지만,
-- TRUNCATE는 외래키 제약조건을 위반하지 않으므로 안전하게 삭제 가능
-- 단, auth.users의 데이터는 삭제되지 않음
TRUNCATE TABLE public.profiles CASCADE;

COMMIT;

-- ============================================================================
-- 검증 쿼리 (수동 실행)
-- ============================================================================
-- 각 테이블의 데이터 개수 확인:
-- SELECT 
--   'profiles' as table_name, COUNT(*) as row_count FROM public.profiles
-- UNION ALL
-- SELECT 'projects', COUNT(*) FROM public.projects
-- UNION ALL
-- SELECT 'project_participants', COUNT(*) FROM public.project_participants
-- UNION ALL
-- SELECT 'tasks', COUNT(*) FROM public.tasks
-- UNION ALL
-- SELECT 'messages', COUNT(*) FROM public.messages
-- UNION ALL
-- SELECT 'email_logs', COUNT(*) FROM public.email_logs;
-- 
-- 모든 테이블이 0개여야 함


