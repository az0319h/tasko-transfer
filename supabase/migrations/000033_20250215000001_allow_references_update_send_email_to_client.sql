-- ============================================================================
-- 참조자도 send_email_to_client 필드 수정 가능하도록 RLS 정책 수정
-- ============================================================================
-- 목적: 업무에 참조자가 포함되어 있다면, 참조자들 + 담당자가 
--       send_email_to_client (전송완료/미전송) 필드를 수정할 수 있어야 함
-- 
-- 중요: RLS 정책은 행(row) 레벨 제어만 가능하며, 컬럼(필드) 레벨 제어는 불가능합니다.
--       따라서 이 정책은 참조자가 tasks 테이블의 UPDATE를 수행할 수 있게만 허용합니다.
--       실제 필드별 권한 제어는 API 레벨(src/api/task.ts의 updateTask 함수)에서 수행됩니다:
--       - 참조자: 오직 send_email_to_client 필드만 수정 가능
--       - 지시자: title, client_name, due_date 필드 수정 가능
--       - 담당자: send_email_to_client 필드 수정 가능
-- 
-- 변경 사항:
-- 1. tasks UPDATE 정책에 참조자 조건 추가
--    - 기존: assigner 또는 assignee만 UPDATE 가능
--    - 변경: assigner 또는 assignee 또는 참조자도 UPDATE 가능
--    - 참고: 실제 필드별 권한은 API에서 엄격하게 체크됨
-- ============================================================================

-- ----------------------------------------------------------------------------
-- tasks UPDATE 정책 수정
-- ----------------------------------------------------------------------------
-- 참조자도 tasks 테이블 UPDATE 가능하도록 정책 수정
-- is_task_reference 함수를 사용하여 참조자 여부 확인

DROP POLICY IF EXISTS "tasks_update_assigner_or_assignee" ON public.tasks;

CREATE POLICY "tasks_update_assigner_assignee_reference_or_admin"
ON public.tasks
FOR UPDATE
USING (
  -- 자기 할당 Task: 지시자만 수정 가능
  ((is_self_task = true) AND (auth.uid() = assigner_id))
  -- 일반 Task: 지시자, 담당자, 참조자, 관리자 수정 가능
  OR ((is_self_task = false) AND (
    (auth.uid() = assigner_id) 
    OR (auth.uid() = assignee_id)
    OR is_task_reference(id, auth.uid())
    OR is_admin(auth.uid())
  ))
)
WITH CHECK (
  -- 자기 할당 Task: 지시자만 수정 가능
  ((is_self_task = true) AND (auth.uid() = assigner_id))
  -- 일반 Task: 지시자, 담당자, 참조자, 관리자 수정 가능
  OR ((is_self_task = false) AND (
    (auth.uid() = assigner_id) 
    OR (auth.uid() = assignee_id)
    OR is_task_reference(id, auth.uid())
    OR is_admin(auth.uid())
  ))
);

COMMENT ON POLICY "tasks_update_assigner_assignee_reference_or_admin" ON public.tasks IS 
'Task 수정 정책: 지시자, 담당자, 참조자, 관리자만 Task UPDATE 가능. 
참고: RLS는 행 레벨 제어만 가능하므로, 실제 필드별 권한은 API 레벨에서 체크됩니다.
- 참조자: 오직 send_email_to_client 필드만 수정 가능 (API에서 제한)
- 지시자: title, client_name, due_date 필드 수정 가능
- 담당자: send_email_to_client 필드 수정 가능';
