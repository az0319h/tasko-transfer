-- ============================================================================
-- Task 공유 기능 구현 - is_public 컬럼 및 RLS 정책 수정
-- ============================================================================
-- 목적: tasks 테이블에 is_public 컬럼 추가 및 공개 Task 접근 로직을 포함한 RLS 정책 수정
-- 
-- 작업 내용:
-- 1. is_public 컬럼 추가 (BOOLEAN NOT NULL DEFAULT false)
-- 2. is_public 인덱스 추가 (공개된 Task 조회 최적화)
-- 3. SELECT RLS 정책 수정 (공개 Task 접근 로직 포함)
-- 4. UPDATE RLS 정책 수정 (관리자 UPDATE 권한 포함)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. is_public 컬럼 추가
-- ----------------------------------------------------------------------------

ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tasks.is_public IS 'Task 공개 여부. true일 경우 모든 사용자가 읽기 전용으로 접근 가능';

-- ----------------------------------------------------------------------------
-- 2. is_public 인덱스 추가
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_tasks_is_public 
ON public.tasks(is_public) 
WHERE is_public = true;

COMMENT ON INDEX idx_tasks_is_public IS '공개된 Task 조회 최적화를 위한 부분 인덱스';

-- ----------------------------------------------------------------------------
-- 3. SELECT RLS 정책 수정 - tasks_select_admin_or_assigned
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS tasks_select_admin_or_assigned ON public.tasks;

CREATE POLICY tasks_select_admin_or_assigned ON public.tasks
FOR SELECT
USING (
  -- 공개된 Task: 모든 인증된 사용자 접근 가능 (자기 할당 Task 제외)
  is_public = true
  OR
  -- 자기 할당 Task: 본인만 접근 가능 (관리자도 제외, 공개 여부와 무관)
  (is_self_task = true AND auth.uid() = assigner_id)
  OR
  -- 일반 비공개 Task: 기존 정책 유지 (관리자 또는 지시자/담당자)
  (is_self_task = false AND is_public = false AND (
    is_admin(auth.uid()) OR 
    auth.uid() = assigner_id OR 
    auth.uid() = assignee_id
  ))
);

COMMENT ON POLICY tasks_select_admin_or_assigned ON public.tasks IS 
'Task 조회 정책: 공개된 Task는 모든 인증된 사용자 접근 가능, 자기 할당 Task는 본인만 접근 가능, 일반 비공개 Task는 관리자 또는 지시자/담당자만 접근 가능';

-- ----------------------------------------------------------------------------
-- 4. UPDATE RLS 정책 수정 - tasks_update_assigner_or_assignee
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS tasks_update_assigner_or_assignee ON public.tasks;

CREATE POLICY tasks_update_assigner_or_assignee ON public.tasks
FOR UPDATE
USING (
  -- 자기 할당 Task: 본인만 수정 가능
  (is_self_task = true AND auth.uid() = assigner_id)
  OR
  -- 일반 Task: 지시자 또는 담당자만 수정 가능
  (is_self_task = false AND (auth.uid() = assigner_id OR auth.uid() = assignee_id))
  OR
  -- 관리자: 모든 Task 수정 가능 (필드별 제어는 애플리케이션 레벨에서 처리)
  is_admin(auth.uid())
)
WITH CHECK (
  -- 동일한 조건 적용
  (is_self_task = true AND auth.uid() = assigner_id)
  OR
  (is_self_task = false AND (auth.uid() = assigner_id OR auth.uid() = assignee_id))
  OR
  is_admin(auth.uid())
);

COMMENT ON POLICY tasks_update_assigner_or_assignee ON public.tasks IS 
'Task 수정 정책: 자기 할당 Task는 본인만 수정 가능, 일반 Task는 지시자/담당자만 수정 가능, 관리자는 모든 Task 수정 가능 (필드별 제어는 API 레벨에서 처리)';

COMMIT;
