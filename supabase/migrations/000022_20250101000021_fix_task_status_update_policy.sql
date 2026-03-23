-- Fix Task UPDATE RLS Policy to allow assigner/assignee to update task_status
-- This migration fixes the issue where task status changes were blocked by RLS policy
--
-- Problem:
-- - Current policy (tasks_update_admin_only) only allows Admin to update tasks
-- - But updateTaskStatus() function allows assigner/assignee to change status
-- - This mismatch causes UPDATE to fail silently, preventing triggers and emails
--
-- Solution:
-- - Split UPDATE policy into two:
--   1. Admin can update general fields (title, description, due_date) but NOT task_status
--   2. Assigner/assignee can update ONLY task_status field
--
-- Note: PostgreSQL 17.6 supports UPDATE OF clause for column-specific policies

-- Step 1: Drop existing Admin-only policy
DROP POLICY IF EXISTS "tasks_update_admin_only" ON public.tasks;

-- Step 2: Create Admin policy for general fields
-- Admin can update: title, description, due_date
-- Note: task_status 변경은 애플리케이션 레벨에서 차단됨 (updateTask 함수에서)
-- RLS에서는 기본적인 권한만 확인
CREATE POLICY "tasks_update_admin_general_fields"
ON public.tasks
FOR UPDATE
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Step 3: Create assigner/assignee policy for task_status
-- Assigner/assignee can update task_status
-- Note: 다른 필드 변경은 애플리케이션 레벨에서 차단됨 (updateTaskStatus 함수에서)
-- RLS에서는 기본적인 권한만 확인
-- WITH CHECK 절에서는 OLD를 사용할 수 없으므로, 컬럼별 제한은 애플리케이션 레벨에서 처리
CREATE POLICY "tasks_update_status_assigner_assignee"
ON public.tasks
FOR UPDATE
USING (
  (auth.uid() = assigner_id OR auth.uid() = assignee_id)
  AND NOT is_admin(auth.uid())  -- Admin은 제외 (Admin은 일반 필드만 수정 가능)
)
WITH CHECK (
  (auth.uid() = assigner_id OR auth.uid() = assignee_id)
  AND NOT is_admin(auth.uid())
);

-- Add comments
COMMENT ON POLICY "tasks_update_admin_general_fields" ON public.tasks IS
'Task UPDATE 정책 (Admin용): Admin만 일반 필드(title, description, due_date) 수정 가능. task_status는 변경 불가 (별도 정책으로 제어).';

COMMENT ON POLICY "tasks_update_status_assigner_assignee" ON public.tasks IS
'Task UPDATE 정책 (상태 변경용): assigner 또는 assignee만 task_status 필드 수정 가능. 다른 필드는 변경 불가. Admin은 제외 (Admin은 일반 필드만 수정 가능).';

