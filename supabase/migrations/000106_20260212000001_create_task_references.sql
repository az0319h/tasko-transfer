-- ============================================================================
-- Phase 1-1: task_references 테이블 생성
-- ============================================================================
-- 목적: Task에 참조자(reference) 추가 기능 지원
-- - 담당자: 1명 (기존 assignee_id)
-- - 참조자: n명 (task_references 테이블로 관리)
-- - 참조자는 채팅·읽음·참조자 전용 이메일만 가능
-- - 일정·알림·상태 변경은 담당자만 가능
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. task_references 테이블 생성
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(task_id, user_id)
);

COMMENT ON TABLE public.task_references IS 
'Task 참조자 테이블: Task당 n명의 참조자 지원. 참조자는 채팅·읽음·이메일만 가능, 일정·알림·상태 변경 불가.';

COMMENT ON COLUMN public.task_references.task_id IS '참조 대상 Task ID';
COMMENT ON COLUMN public.task_references.user_id IS '참조자 User ID';
COMMENT ON COLUMN public.task_references.created_at IS '참조자 추가 시간';

-- ----------------------------------------------------------------------------
-- 2. 인덱스 생성
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_task_references_task_id 
ON public.task_references(task_id);

CREATE INDEX IF NOT EXISTS idx_task_references_user_id 
ON public.task_references(user_id);

COMMENT ON INDEX public.idx_task_references_task_id IS 
'Task별 참조자 조회 최적화';

COMMENT ON INDEX public.idx_task_references_user_id IS 
'User별 참조된 Task 조회 최적화';

-- ----------------------------------------------------------------------------
-- 3. RLS 활성화
-- ----------------------------------------------------------------------------
ALTER TABLE public.task_references ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 4. RLS 정책 생성
-- ----------------------------------------------------------------------------

-- SELECT 정책: assigner, assignee, 참조자, admin만 조회 가능
DROP POLICY IF EXISTS "task_references_select_task_participants_or_admin" ON public.task_references;

CREATE POLICY "task_references_select_task_participants_or_admin"
ON public.task_references
FOR SELECT
USING (
  -- Admin은 모든 참조자 정보 조회 가능
  is_admin((SELECT auth.uid()))
  -- Task의 지시자, 담당자, 참조자는 해당 Task의 참조자 목록 조회 가능
  OR EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = task_references.task_id
    AND (
      tasks.assigner_id = (SELECT auth.uid())
      OR tasks.assignee_id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.task_references tr
        WHERE tr.task_id = tasks.id
        AND tr.user_id = (SELECT auth.uid())
      )
    )
  )
);

COMMENT ON POLICY "task_references_select_task_participants_or_admin" ON public.task_references IS 
'참조자 조회 정책: Admin 또는 해당 Task의 지시자/담당자/참조자만 참조자 목록 조회 가능.';

-- INSERT 정책: assigner 또는 admin만 참조자 추가 가능
DROP POLICY IF EXISTS "task_references_insert_assigner_or_admin" ON public.task_references;

CREATE POLICY "task_references_insert_assigner_or_admin"
ON public.task_references
FOR INSERT
WITH CHECK (
  -- Admin은 모든 Task에 참조자 추가 가능
  is_admin((SELECT auth.uid()))
  -- 지시자만 해당 Task에 참조자 추가 가능
  OR EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = task_references.task_id
    AND tasks.assigner_id = (SELECT auth.uid())
  )
);

COMMENT ON POLICY "task_references_insert_assigner_or_admin" ON public.task_references IS 
'참조자 추가 정책: Admin 또는 지시자만 참조자 추가 가능.';

-- DELETE 정책: assigner 또는 admin만 참조자 제거 가능
DROP POLICY IF EXISTS "task_references_delete_assigner_or_admin" ON public.task_references;

CREATE POLICY "task_references_delete_assigner_or_admin"
ON public.task_references
FOR DELETE
USING (
  -- Admin은 모든 참조자 제거 가능
  is_admin((SELECT auth.uid()))
  -- 지시자만 해당 Task의 참조자 제거 가능
  OR EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = task_references.task_id
    AND tasks.assigner_id = (SELECT auth.uid())
  )
);

COMMENT ON POLICY "task_references_delete_assigner_or_admin" ON public.task_references IS 
'참조자 제거 정책: Admin 또는 지시자만 참조자 제거 가능.';

-- ----------------------------------------------------------------------------
-- 5. Realtime 활성화 (선택 사항)
-- ----------------------------------------------------------------------------
-- 참조자 추가/제거 시 실시간 반영을 위해 Realtime 활성화
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.task_references;
