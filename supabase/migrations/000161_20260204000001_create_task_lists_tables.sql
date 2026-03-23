-- ============================================================================
-- Task Lists System: 테이블 생성 및 RLS 정책
-- ============================================================================
-- 목적: Task 목록 관리 시스템 구현
-- - task_lists: 사용자가 만든 Task 목록 (제목만 저장)
-- - task_list_items: 각 목록에 포함된 Task들
-- 
-- 요구사항:
-- 1. 관리자: 모든 Task에 대해 목록 생성 가능
-- 2. 멤버: 자신이 속한 Task(assigner/assignee)만 목록에 추가 가능
-- 3. Task 삭제 시 목록에서 자동 제거 (CASCADE)
-- 4. 같은 Task가 여러 목록에 포함 가능
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. task_lists 테이블 생성
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT task_lists_title_not_empty CHECK (length(trim(title)) > 0)
);

-- ----------------------------------------------------------------------------
-- 2. task_list_items 테이블 생성
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_list_id UUID NOT NULL REFERENCES public.task_lists(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT task_list_items_unique UNIQUE (task_list_id, task_id)
);

-- ----------------------------------------------------------------------------
-- 3. 인덱스 생성
-- ----------------------------------------------------------------------------
-- task_lists 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_task_lists_user_id ON public.task_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_task_lists_created_at ON public.task_lists(created_at DESC);

-- task_list_items 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_task_list_items_task_list_id ON public.task_list_items(task_list_id);
CREATE INDEX IF NOT EXISTS idx_task_list_items_task_id ON public.task_list_items(task_id);
CREATE INDEX IF NOT EXISTS idx_task_list_items_created_at ON public.task_list_items(created_at DESC);

-- ----------------------------------------------------------------------------
-- 4. updated_at 트리거 설정
-- ----------------------------------------------------------------------------
-- task_lists 테이블의 updated_at 트리거
CREATE TRIGGER update_task_lists_updated_at
  BEFORE UPDATE ON public.task_lists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 5. RLS 활성화
-- ----------------------------------------------------------------------------
ALTER TABLE public.task_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_list_items ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 6. RLS 정책 설정
-- ----------------------------------------------------------------------------

-- task_lists SELECT 정책: 자신이 만든 목록만 조회 가능
CREATE POLICY "task_lists_select_own"
ON public.task_lists
FOR SELECT
USING (auth.uid() = user_id);

-- task_lists INSERT 정책: 인증된 사용자만 생성 가능
CREATE POLICY "task_lists_insert_authenticated"
ON public.task_lists
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- task_lists UPDATE 정책: 자신이 만든 목록만 수정 가능
CREATE POLICY "task_lists_update_own"
ON public.task_lists
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- task_lists DELETE 정책: 자신이 만든 목록만 삭제 가능
CREATE POLICY "task_lists_delete_own"
ON public.task_lists
FOR DELETE
USING (auth.uid() = user_id);

-- task_list_items SELECT 정책: 자신이 만든 목록의 항목만 조회 가능
CREATE POLICY "task_list_items_select_own_list"
ON public.task_list_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.task_lists
    WHERE task_lists.id = task_list_items.task_list_id
    AND task_lists.user_id = auth.uid()
  )
);

-- task_list_items INSERT 정책: 
-- 1. 자신이 만든 목록에만 추가 가능
-- 2. 관리자는 모든 Task 추가 가능
-- 3. 멤버는 자신이 assigner 또는 assignee인 Task만 추가 가능
CREATE POLICY "task_list_items_insert_own_list_with_permission"
ON public.task_list_items
FOR INSERT
WITH CHECK (
  -- 자신이 만든 목록인지 확인
  EXISTS (
    SELECT 1 FROM public.task_lists
    WHERE task_lists.id = task_list_items.task_list_id
    AND task_lists.user_id = auth.uid()
  )
  AND (
    -- 관리자는 모든 Task 추가 가능
    is_admin(auth.uid())
    OR
    -- 멤버는 자신이 assigner 또는 assignee인 Task만 추가 가능
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_list_items.task_id
      AND (tasks.assigner_id = auth.uid() OR tasks.assignee_id = auth.uid())
    )
  )
);

-- task_list_items UPDATE 정책: 자신이 만든 목록의 항목만 수정 가능 (display_order 업데이트용)
CREATE POLICY "task_list_items_update_own_list"
ON public.task_list_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.task_lists
    WHERE task_lists.id = task_list_items.task_list_id
    AND task_lists.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.task_lists
    WHERE task_lists.id = task_list_items.task_list_id
    AND task_lists.user_id = auth.uid()
  )
);

-- task_list_items DELETE 정책: 자신이 만든 목록의 항목만 삭제 가능
CREATE POLICY "task_list_items_delete_own_list"
ON public.task_list_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.task_lists
    WHERE task_lists.id = task_list_items.task_list_id
    AND task_lists.user_id = auth.uid()
  )
);

-- ----------------------------------------------------------------------------
-- 7. 테이블 및 컬럼 코멘트 추가
-- ----------------------------------------------------------------------------
COMMENT ON TABLE public.task_lists IS 'Task 목록 테이블: 사용자가 만든 Task 목록 (제목만 저장)';
COMMENT ON COLUMN public.task_lists.user_id IS '목록을 만든 사용자 ID (auth.users 참조)';
COMMENT ON COLUMN public.task_lists.title IS '목록 제목';
COMMENT ON COLUMN public.task_lists.created_at IS '목록 생성 일시';
COMMENT ON COLUMN public.task_lists.updated_at IS '목록 수정 일시';

COMMENT ON TABLE public.task_list_items IS 'Task 목록 항목 테이블: 각 목록에 포함된 Task들';
COMMENT ON COLUMN public.task_list_items.task_list_id IS '목록 ID (task_lists 참조)';
COMMENT ON COLUMN public.task_list_items.task_id IS 'Task ID (tasks 참조, CASCADE 삭제)';
COMMENT ON COLUMN public.task_list_items.created_at IS '목록에 추가된 일시';

COMMENT ON CONSTRAINT task_list_items_unique ON public.task_list_items IS '같은 목록에 같은 Task 중복 방지 (같은 Task는 여러 목록에 포함 가능)';

COMMENT ON POLICY "task_list_items_update_own_list" ON public.task_list_items IS 
'Task 목록 항목 UPDATE 정책: 자신이 만든 목록의 항목만 수정 가능 (display_order 업데이트용)';

COMMIT;
