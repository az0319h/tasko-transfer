-- ============================================================================
-- Phase 1: Task 1-4 - 데이터 마이그레이션 검증 쿼리
-- ============================================================================
-- 목적: 마이그레이션 후 데이터 무결성 확인
-- 
-- 검증 내용:
-- 1. 모든 tasks에 created_by, client_name이 정상적으로 복사되었는지 확인
-- 2. project_id가 NULL인 tasks 확인
-- 3. projects 테이블에 존재하지 않는 project_id를 가진 tasks 확인
-- ============================================================================

-- 1. 전체 tasks 통계
SELECT 
  COUNT(*) as total_tasks,
  COUNT(created_by) as tasks_with_created_by,
  COUNT(client_name) as tasks_with_client_name,
  COUNT(CASE WHEN created_by IS NOT NULL AND client_name IS NOT NULL THEN 1 END) as tasks_with_both,
  COUNT(CASE WHEN created_by IS NULL OR client_name IS NULL THEN 1 END) as tasks_missing_data
FROM public.tasks;

-- 2. project_id가 NULL인 tasks 확인
SELECT COUNT(*) as tasks_with_null_project_id
FROM public.tasks
WHERE project_id IS NULL;

-- 3. projects 테이블에 존재하지 않는 project_id를 가진 tasks 확인
SELECT COUNT(*) as orphaned_tasks
FROM public.tasks t
LEFT JOIN public.projects p ON t.project_id = p.id
WHERE t.project_id IS NOT NULL
  AND p.id IS NULL;

-- 4. 샘플 데이터 확인 (처음 5개)
SELECT 
  t.id,
  t.title,
  t.project_id,
  t.created_by,
  t.client_name,
  p.title as project_title,
  p.created_by as project_created_by,
  p.client_name as project_client_name
FROM public.tasks t
LEFT JOIN public.projects p ON t.project_id = p.id
LIMIT 5;
