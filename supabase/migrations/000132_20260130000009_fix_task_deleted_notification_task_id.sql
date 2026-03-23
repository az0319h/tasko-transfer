-- ============================================================================
-- Task 삭제 알림 수정: task_id를 NULL로 설정하여 CASCADE 삭제 방지
-- ============================================================================
-- 목적: Task 삭제 시 생성된 알림이 CASCADE로 삭제되지 않도록 task_id를 NULL로 설정
-- 
-- 문제:
-- - notifications 테이블의 task_id가 ON DELETE CASCADE로 설정되어 있음
-- - Task 삭제 시 트리거로 알림을 생성하지만, Task가 이미 삭제되어 CASCADE로 알림도 삭제됨
-- 
-- 해결:
-- - 트리거 함수에서 task_id를 NULL로 설정
-- - Task 정보는 metadata에 저장되어 있으므로 참조 가능
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Task 삭제 알림 함수 수정: task_id를 NULL로 설정
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_task_deleted_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignee_name TEXT;
  v_task_title TEXT;
BEGIN
  -- 담당자가 없는 경우 알림 생성하지 않음
  IF OLD.assignee_id IS NULL THEN
    RETURN OLD;
  END IF;

  -- 담당자 이름 조회 (Task 생성 알림과 동일한 패턴)
  SELECT COALESCE(full_name, email) INTO v_assignee_name
  FROM public.profiles
  WHERE id = OLD.assignee_id;

  -- Task 제목
  v_task_title := OLD.title;

  -- 담당자에게 Task 삭제 알림 생성
  -- task_id를 NULL로 설정하여 CASCADE 삭제 방지
  -- Task 정보는 metadata에 저장되어 있으므로 참조 가능
  PERFORM public.create_notification(
    p_user_id := OLD.assignee_id,
    p_notification_type := 'TASK_DELETED',
    p_title := 'Task가 삭제되었습니다',
    p_message := format('%s Task가 삭제되었습니다.', v_task_title),
    p_task_id := NULL,  -- NULL로 설정하여 CASCADE 삭제 방지
    p_metadata := jsonb_build_object(
      'task_title', v_task_title,
      'task_id', OLD.id,  -- metadata에 task_id 저장
      'assigner_id', OLD.assigner_id
    )
  );

  RETURN OLD;
EXCEPTION
  WHEN OTHERS THEN
    -- 알림 생성 실패해도 Task 삭제는 성공해야 함
    RAISE WARNING 'Failed to create task deleted notification: %', SQLERRM;
    RETURN OLD;
END;
$$;

-- ----------------------------------------------------------------------------
-- 함수 주석 업데이트
-- ----------------------------------------------------------------------------

COMMENT ON FUNCTION public.create_task_deleted_notification() IS 
'Task 삭제 시 담당자에게 TASK_DELETED 알림을 생성하는 트리거 함수. task_id를 NULL로 설정하여 CASCADE 삭제를 방지하며, Task 정보는 metadata에 저장됩니다.';

COMMIT;
