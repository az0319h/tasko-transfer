-- ============================================================================
-- Task List Items: display_order 컬럼 추가
-- ============================================================================
-- 목적: Task 목록 내에서 Task 순서를 관리하기 위한 컬럼 추가
-- - display_order: 각 목록 내에서 Task의 표시 순서 (0부터 시작)
-- - 각 목록별로 독립적인 순서 관리
-- 
-- 요구사항:
-- 1. 기존 데이터는 created_at 기준으로 순서 초기화
-- 2. 같은 목록 내에서 같은 display_order는 불가 (UNIQUE 제약조건)
-- 3. 인덱스 추가로 성능 최적화
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. display_order 컬럼 추가 (NULL 허용, 나중에 값 채운 후 NOT NULL로 변경)
-- ----------------------------------------------------------------------------
ALTER TABLE public.task_list_items 
ADD COLUMN IF NOT EXISTS display_order INTEGER;

-- ----------------------------------------------------------------------------
-- 2. 기존 데이터에 display_order 초기화
-- 각 목록별로 created_at 기준으로 정렬하여 0부터 시작하는 순서 부여
-- ----------------------------------------------------------------------------
WITH ordered_items AS (
  SELECT 
    id,
    task_list_id,
    ROW_NUMBER() OVER (PARTITION BY task_list_id ORDER BY created_at ASC) - 1 AS new_order
  FROM public.task_list_items
  WHERE display_order IS NULL
)
UPDATE public.task_list_items
SET display_order = ordered_items.new_order
FROM ordered_items
WHERE task_list_items.id = ordered_items.id;

-- ----------------------------------------------------------------------------
-- 3. display_order를 NOT NULL로 변경
-- ----------------------------------------------------------------------------
ALTER TABLE public.task_list_items 
ALTER COLUMN display_order SET NOT NULL;

-- ----------------------------------------------------------------------------
-- 4. 기본값 설정 (새 항목 추가 시 자동으로 마지막 순서로 배치)
-- ----------------------------------------------------------------------------
ALTER TABLE public.task_list_items 
ALTER COLUMN display_order SET DEFAULT 0;

-- ----------------------------------------------------------------------------
-- 5. UNIQUE 제약조건 추가 (같은 목록 내에서 같은 display_order는 불가)
-- ----------------------------------------------------------------------------
ALTER TABLE public.task_list_items
ADD CONSTRAINT task_list_items_order_unique 
UNIQUE (task_list_id, display_order);

-- ----------------------------------------------------------------------------
-- 6. 인덱스 생성 (성능 최적화)
-- 목록별로 순서대로 조회할 때 사용
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_task_list_items_display_order 
ON public.task_list_items(task_list_id, display_order);

-- ----------------------------------------------------------------------------
-- 7. 코멘트 추가
-- ----------------------------------------------------------------------------
COMMENT ON COLUMN public.task_list_items.display_order IS '목록 내 Task 표시 순서 (0부터 시작, 각 목록별로 독립적)';

-- ----------------------------------------------------------------------------
-- 8. UPDATE RLS 정책 추가 (display_order 업데이트를 위해 필요)
-- ----------------------------------------------------------------------------
-- task_list_items UPDATE 정책: 자신이 만든 목록의 항목만 수정 가능 (display_order 업데이트용)
CREATE POLICY IF NOT EXISTS "task_list_items_update_own_list"
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

COMMENT ON POLICY "task_list_items_update_own_list" ON public.task_list_items IS 
'Task 목록 항목 UPDATE 정책: 자신이 만든 목록의 항목만 수정 가능 (display_order 업데이트용)';

COMMIT;
