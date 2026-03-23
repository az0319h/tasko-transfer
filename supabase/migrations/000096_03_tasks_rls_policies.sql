-- ============================================================================
-- Phase 1: Task 3-1 - tasks 테이블 RLS 정책 변경
-- ============================================================================
-- 목적: 프로젝트 기반 RLS 정책 제거 및 새로운 태스크 단위 RLS 정책 생성
-- 
-- 작업 내용:
-- 1. 새 정책 생성 (project_id 의존성 제거)
-- 2. 기존 정책 제거 (project_id 사용하는 정책들)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1단계: 새 정책 생성 (먼저 실행)
-- ----------------------------------------------------------------------------

-- SELECT 정책: 관리자는 모든 태스크, 멤버는 자신이 지시자/담당자인 태스크만
DROP POLICY IF EXISTS "tasks_select_admin_or_assigned" ON public.tasks;
CREATE POLICY "tasks_select_admin_or_assigned"
ON public.tasks
FOR SELECT
USING (
  is_admin(auth.uid())
  OR auth.uid() = assigner_id
  OR auth.uid() = assignee_id
);

-- INSERT 정책: 인증된 사용자만 생성 가능
DROP POLICY IF EXISTS "tasks_insert_authenticated" ON public.tasks;
CREATE POLICY "tasks_insert_authenticated"
ON public.tasks
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE 정책: 지시자 또는 담당자만 수정 가능
DROP POLICY IF EXISTS "tasks_update_assigner_or_assignee" ON public.tasks;
CREATE POLICY "tasks_update_assigner_or_assignee"
ON public.tasks
FOR UPDATE
USING (
  auth.uid() = assigner_id
  OR auth.uid() = assignee_id
)
WITH CHECK (
  auth.uid() = assigner_id
  OR auth.uid() = assignee_id
);

-- DELETE 정책: 관리자만 삭제 가능
DROP POLICY IF EXISTS "tasks_delete_admin_only" ON public.tasks;
CREATE POLICY "tasks_delete_admin_only"
ON public.tasks
FOR DELETE
USING (is_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- 2단계: 기존 정책 제거 (새 정책 생성 후 실행)
-- ----------------------------------------------------------------------------

-- project_id를 사용하는 기존 정책들 제거
DROP POLICY IF EXISTS "tasks_select_participant_or_admin" ON public.tasks;
DROP POLICY IF EXISTS "tasks_select_project_access" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert_participant_or_admin" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert_admin_or_participant" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_assigner_only" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_assignee_status" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_admin_or_assigner_assignee" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_assigner_or_assignee_only" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete_assigner_only" ON public.tasks;

-- ----------------------------------------------------------------------------
-- 3. 정책 코멘트 추가
-- ----------------------------------------------------------------------------

COMMENT ON POLICY "tasks_select_admin_or_assigned" ON public.tasks IS 
'태스크 조회 정책: 관리자는 모든 태스크 조회 가능, 멤버는 자신이 지시자/담당자인 태스크만 조회 가능';

COMMENT ON POLICY "tasks_insert_authenticated" ON public.tasks IS 
'태스크 생성 정책: 인증된 사용자만 태스크 생성 가능';

COMMENT ON POLICY "tasks_update_assigner_or_assignee" ON public.tasks IS 
'태스크 수정 정책: 지시자 또는 담당자만 태스크 수정 가능';

COMMENT ON POLICY "tasks_delete_admin_only" ON public.tasks IS 
'태스크 삭제 정책: 관리자만 태스크 삭제 가능';

COMMIT;
