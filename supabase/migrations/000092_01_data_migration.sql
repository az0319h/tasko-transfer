-- ============================================================================
-- Phase 1: Task 1-3 - 데이터 마이그레이션 (projects → tasks)
-- ============================================================================
-- 목적: projects 테이블의 created_by, client_name을 관련된 모든 tasks로 복사
-- 
-- 작업 내용:
-- 1. projects의 created_by를 tasks의 created_by로 복사
-- 2. projects의 client_name을 tasks의 client_name으로 복사
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 데이터 마이그레이션: projects → tasks
-- ----------------------------------------------------------------------------

UPDATE public.tasks t
SET 
  created_by = p.created_by,
  client_name = p.client_name
FROM public.projects p
WHERE t.project_id = p.id
  AND (t.created_by IS NULL OR t.client_name IS NULL);

-- 마이그레이션 결과 확인
DO $$
DECLARE
  updated_count INTEGER;
  total_tasks INTEGER;
  tasks_with_data INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_tasks FROM public.tasks;
  SELECT COUNT(*) INTO tasks_with_data 
  FROM public.tasks 
  WHERE created_by IS NOT NULL AND client_name IS NOT NULL;
  
  RAISE NOTICE '총 tasks 수: %', total_tasks;
  RAISE NOTICE 'created_by와 client_name이 모두 설정된 tasks 수: %', tasks_with_data;
  
  IF tasks_with_data < total_tasks THEN
    RAISE WARNING '일부 tasks에 데이터가 마이그레이션되지 않았습니다. project_id가 NULL이거나 projects 테이블에 해당 프로젝트가 없을 수 있습니다.';
  ELSE
    RAISE NOTICE '모든 tasks에 데이터가 성공적으로 마이그레이션되었습니다.';
  END IF;
END $$;

COMMIT;
