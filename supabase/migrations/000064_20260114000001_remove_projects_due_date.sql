-- Remove projects.due_date column and its index
-- This migration removes the due_date column from the projects table as it's no longer needed.
-- Task due_date will remain and be made required separately.

-- Drop index first
DROP INDEX IF EXISTS public.idx_projects_due_date;

-- Drop column
ALTER TABLE public.projects DROP COLUMN IF EXISTS due_date;

-- Add comment for documentation
COMMENT ON TABLE public.projects IS '프로젝트 정보를 저장하는 테이블 (완료예정일 제거됨)';
