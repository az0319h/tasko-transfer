-- ============================================================================
-- 알림 시스템 수정: 상태 변경 알림 제거 및 삭제 알림 수정
-- ============================================================================
-- 목적: 
-- 1. Task 상태 변경 알림 제거 (알림이 너무 많아짐)
-- 2. Task 삭제 알림 수정 (담당자에게 정상 전송되도록 Task 생성 알림과 동일한 패턴 적용)
-- 
-- 작업 내용:
-- 1. Task 상태 변경 트리거 및 함수 제거
-- 2. Task 삭제 알림 함수 수정 (담당자 이름 조회 추가, 메시지 형식 통일)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Task 상태 변경 트리거 제거
-- ----------------------------------------------------------------------------

-- 트리거 제거
DROP TRIGGER IF EXISTS trigger_create_task_status_changed_notification ON public.tasks;

-- 트리거 함수 제거
DROP FUNCTION IF EXISTS public.create_task_status_changed_notification();

-- ----------------------------------------------------------------------------
-- 2. Task 삭제 알림 함수 수정
-- ----------------------------------------------------------------------------
-- Task 생성 알림과 동일한 패턴으로 수정:
-- - 담당자 이름 조회 추가
-- - 메시지 형식 통일
-- - 메타데이터 구조 통일

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
-- 3. 함수 주석 업데이트
-- ----------------------------------------------------------------------------

COMMENT ON FUNCTION public.create_task_deleted_notification() IS 
'Task 삭제 시 담당자에게 TASK_DELETED 알림을 생성하는 트리거 함수. task_id를 NULL로 설정하여 CASCADE 삭제를 방지하며, Task 정보는 metadata에 저장됩니다.';

COMMIT;
