-- ============================================================================
-- 알림 생성 트리거 생성
-- ============================================================================
-- 목적: Task 생성/상태 변경/삭제 시 자동으로 알림 생성
-- 
-- 작업 내용:
-- 1. Task 생성 트리거 (TASK_CREATED 알림)
-- 2. Task 상태 변경 트리거 (TASK_STATUS_CHANGED 알림)
-- 3. Task 삭제 트리거 (TASK_DELETED 알림)
-- 4. 마감일 초과 알림 (TASK_DUE_DATE_EXCEEDED 알림)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Task 생성 트리거 함수
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_task_created_notification()
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
  IF NEW.assignee_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 담당자 이름 조회
  SELECT COALESCE(full_name, email) INTO v_assignee_name
  FROM public.profiles
  WHERE id = NEW.assignee_id;

  -- Task 제목
  v_task_title := NEW.title;

  -- 담당자에게 Task 생성 알림 생성
  PERFORM public.create_notification(
    p_user_id := NEW.assignee_id,
    p_notification_type := 'TASK_CREATED',
    p_title := '새 Task가 배정되었습니다',
    p_message := format('%s Task가 배정되었습니다.', v_task_title),
    p_task_id := NEW.id,
    p_metadata := jsonb_build_object(
      'task_title', v_task_title,
      'assigner_id', NEW.assigner_id
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- 알림 생성 실패해도 Task 생성은 성공해야 함
    RAISE WARNING 'Failed to create task created notification: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Task 생성 트리거 생성
DROP TRIGGER IF EXISTS trigger_create_task_created_notification ON public.tasks;
CREATE TRIGGER trigger_create_task_created_notification
  AFTER INSERT ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.create_task_created_notification();

COMMENT ON FUNCTION public.create_task_created_notification() IS 
'Task 생성 시 담당자에게 TASK_CREATED 알림을 생성하는 트리거 함수';

-- ----------------------------------------------------------------------------
-- 2. Task 상태 변경 트리거 함수
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_task_status_changed_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status_label TEXT;
  v_new_status_label TEXT;
  v_task_title TEXT;
  v_assigner_name TEXT;
  v_assignee_name TEXT;
  v_changer_name TEXT;
  v_recipient_id UUID;
  v_notification_title TEXT;
  v_notification_message TEXT;
BEGIN
  -- 상태가 변경되지 않은 경우 알림 생성하지 않음
  IF OLD.task_status = NEW.task_status THEN
    RETURN NEW;
  END IF;

  -- Task 제목
  v_task_title := NEW.title;

  -- 상태 한글명 매핑
  v_old_status_label := CASE OLD.task_status
    WHEN 'ASSIGNED' THEN '할당됨'
    WHEN 'IN_PROGRESS' THEN '진행 중'
    WHEN 'WAITING_CONFIRM' THEN '확인 대기'
    WHEN 'APPROVED' THEN '승인됨'
    WHEN 'REJECTED' THEN '거부됨'
    ELSE OLD.task_status::TEXT
  END;

  v_new_status_label := CASE NEW.task_status
    WHEN 'ASSIGNED' THEN '할당됨'
    WHEN 'IN_PROGRESS' THEN '진행 중'
    WHEN 'WAITING_CONFIRM' THEN '확인 대기'
    WHEN 'APPROVED' THEN '승인됨'
    WHEN 'REJECTED' THEN '거부됨'
    ELSE NEW.task_status::TEXT
  END;

  -- 변경자 이름 조회
  SELECT COALESCE(full_name, email) INTO v_changer_name
  FROM public.profiles
  WHERE id = auth.uid();

  -- 상태 전환에 따라 수신자 결정 및 알림 생성
  IF OLD.task_status = 'ASSIGNED' AND NEW.task_status = 'IN_PROGRESS' THEN
    -- ASSIGNED → IN_PROGRESS: 지시자 + 담당자 모두
    v_notification_title := 'Task 상태가 변경되었습니다';
    v_notification_message := format('%s Task의 상태가 %s에서 %s로 변경되었습니다. (변경자: %s)', 
      v_task_title, v_old_status_label, v_new_status_label, v_changer_name);

    -- 지시자에게 알림 생성
    IF NEW.assigner_id IS NOT NULL THEN
      PERFORM public.create_notification(
        p_user_id := NEW.assigner_id,
        p_notification_type := 'TASK_STATUS_CHANGED',
        p_title := v_notification_title,
        p_message := v_notification_message,
        p_task_id := NEW.id,
        p_metadata := jsonb_build_object(
          'old_status', OLD.task_status,
          'new_status', NEW.task_status,
          'old_status_label', v_old_status_label,
          'new_status_label', v_new_status_label,
          'changer_id', auth.uid(),
          'changer_name', v_changer_name
        )
      );
    END IF;

    -- 담당자에게 알림 생성
    IF NEW.assignee_id IS NOT NULL THEN
      PERFORM public.create_notification(
        p_user_id := NEW.assignee_id,
        p_notification_type := 'TASK_STATUS_CHANGED',
        p_title := v_notification_title,
        p_message := v_notification_message,
        p_task_id := NEW.id,
        p_metadata := jsonb_build_object(
          'old_status', OLD.task_status,
          'new_status', NEW.task_status,
          'old_status_label', v_old_status_label,
          'new_status_label', v_new_status_label,
          'changer_id', auth.uid(),
          'changer_name', v_changer_name
        )
      );
    END IF;

  ELSIF OLD.task_status = 'IN_PROGRESS' AND NEW.task_status = 'WAITING_CONFIRM' THEN
    -- IN_PROGRESS → WAITING_CONFIRM: 지시자만
    v_notification_title := 'Task 확인 요청이 있습니다';
    v_notification_message := format('%s Task의 상태가 %s에서 %s로 변경되었습니다. 확인이 필요합니다. (변경자: %s)', 
      v_task_title, v_old_status_label, v_new_status_label, v_changer_name);

    IF NEW.assigner_id IS NOT NULL THEN
      PERFORM public.create_notification(
        p_user_id := NEW.assigner_id,
        p_notification_type := 'TASK_STATUS_CHANGED',
        p_title := v_notification_title,
        p_message := v_notification_message,
        p_task_id := NEW.id,
        p_metadata := jsonb_build_object(
          'old_status', OLD.task_status,
          'new_status', NEW.task_status,
          'old_status_label', v_old_status_label,
          'new_status_label', v_new_status_label,
          'changer_id', auth.uid(),
          'changer_name', v_changer_name
        )
      );
    END IF;

  ELSIF OLD.task_status = 'WAITING_CONFIRM' AND NEW.task_status IN ('APPROVED', 'REJECTED') THEN
    -- WAITING_CONFIRM → APPROVED/REJECTED: 담당자만
    v_notification_title := CASE NEW.task_status
      WHEN 'APPROVED' THEN 'Task가 승인되었습니다'
      WHEN 'REJECTED' THEN 'Task가 반려되었습니다'
      ELSE 'Task 상태가 변경되었습니다'
    END;
    v_notification_message := format('%s Task의 상태가 %s에서 %s로 변경되었습니다. (변경자: %s)', 
      v_task_title, v_old_status_label, v_new_status_label, v_changer_name);

    IF NEW.assignee_id IS NOT NULL THEN
      PERFORM public.create_notification(
        p_user_id := NEW.assignee_id,
        p_notification_type := 'TASK_STATUS_CHANGED',
        p_title := v_notification_title,
        p_message := v_notification_message,
        p_task_id := NEW.id,
        p_metadata := jsonb_build_object(
          'old_status', OLD.task_status,
          'new_status', NEW.task_status,
          'old_status_label', v_old_status_label,
          'new_status_label', v_new_status_label,
          'changer_id', auth.uid(),
          'changer_name', v_changer_name
        )
      );
    END IF;

  ELSIF OLD.task_status = 'REJECTED' AND NEW.task_status = 'IN_PROGRESS' THEN
    -- REJECTED → IN_PROGRESS: 지시자만
    v_notification_title := 'Task가 다시 진행 중입니다';
    v_notification_message := format('%s Task의 상태가 %s에서 %s로 변경되었습니다. 업무가 재진행되었습니다. (변경자: %s)', 
      v_task_title, v_old_status_label, v_new_status_label, v_changer_name);

    IF NEW.assigner_id IS NOT NULL THEN
      PERFORM public.create_notification(
        p_user_id := NEW.assigner_id,
        p_notification_type := 'TASK_STATUS_CHANGED',
        p_title := v_notification_title,
        p_message := v_notification_message,
        p_task_id := NEW.id,
        p_metadata := jsonb_build_object(
          'old_status', OLD.task_status,
          'new_status', NEW.task_status,
          'old_status_label', v_old_status_label,
          'new_status_label', v_new_status_label,
          'changer_id', auth.uid(),
          'changer_name', v_changer_name
        )
      );
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- 알림 생성 실패해도 상태 변경은 성공해야 함
    RAISE WARNING 'Failed to create task status changed notification: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Task 상태 변경 트리거 생성
DROP TRIGGER IF EXISTS trigger_create_task_status_changed_notification ON public.tasks;
CREATE TRIGGER trigger_create_task_status_changed_notification
  AFTER UPDATE OF task_status ON public.tasks
  FOR EACH ROW
  WHEN (OLD.task_status IS DISTINCT FROM NEW.task_status)
  EXECUTE FUNCTION public.create_task_status_changed_notification();

COMMENT ON FUNCTION public.create_task_status_changed_notification() IS 
'Task 상태 변경 시 상태 전환에 따라 지시자 또는 담당자에게 TASK_STATUS_CHANGED 알림을 생성하는 트리거 함수';

-- ----------------------------------------------------------------------------
-- 3. Task 삭제 트리거 함수
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_task_deleted_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task_title TEXT;
BEGIN
  -- 담당자가 없는 경우 알림 생성하지 않음
  IF OLD.assignee_id IS NULL THEN
    RETURN OLD;
  END IF;

  -- Task 제목
  v_task_title := OLD.title;

  -- 담당자에게 Task 삭제 알림 생성
  PERFORM public.create_notification(
    p_user_id := OLD.assignee_id,
    p_notification_type := 'TASK_DELETED',
    p_title := 'Task가 삭제되었습니다',
    p_message := format('%s Task가 삭제되었습니다.', v_task_title),
    p_task_id := OLD.id,
    p_metadata := jsonb_build_object(
      'task_title', v_task_title,
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

-- Task 삭제 트리거 생성
DROP TRIGGER IF EXISTS trigger_create_task_deleted_notification ON public.tasks;
CREATE TRIGGER trigger_create_task_deleted_notification
  AFTER DELETE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.create_task_deleted_notification();

COMMENT ON FUNCTION public.create_task_deleted_notification() IS 
'Task 삭제 시 담당자에게 TASK_DELETED 알림을 생성하는 트리거 함수';

-- ----------------------------------------------------------------------------
-- 4. 마감일 초과 알림 (Task 생성 트리거에 통합)
-- ----------------------------------------------------------------------------
-- 마감일 초과 알림은 Task 생성 시 checkDueDateExceeded Edge Function 호출 결과를
-- 확인하여 생성하거나, 별도 트리거에서 처리할 수 있습니다.
-- 현재는 Task 생성 트리거에서 처리하지 않고, Edge Function에서 처리하도록 합니다.
-- 필요시 별도 트리거를 추가할 수 있습니다.

COMMIT;
