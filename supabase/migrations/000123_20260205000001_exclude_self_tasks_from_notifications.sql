-- =====================================================
-- 나의 태스크 기능 구현 마이그레이션 (2/2)
-- 알림 트리거 함수 수정: 자기 할당 Task 제외
-- =====================================================

-- 1. create_task_created_notification: is_self_task = true일 때 early return
CREATE OR REPLACE FUNCTION public.create_task_created_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_assignee_name TEXT;
  v_task_title TEXT;
BEGIN
  -- 자기 할당 Task는 알림 생성하지 않음
  IF NEW.is_self_task = true THEN
    RETURN NEW;
  END IF;

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
$function$;

-- 2. create_task_deleted_notification: is_self_task = true일 때 early return
CREATE OR REPLACE FUNCTION public.create_task_deleted_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_assignee_name TEXT;
  v_task_title TEXT;
BEGIN
  -- 자기 할당 Task는 알림 생성하지 않음
  IF OLD.is_self_task = true THEN
    RETURN OLD;
  END IF;

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
  PERFORM public.create_notification(
    p_user_id := OLD.assignee_id,
    p_notification_type := 'TASK_DELETED',
    p_title := 'Task가 삭제되었습니다',
    p_message := format('%s Task가 삭제되었습니다.', v_task_title),
    p_task_id := NULL,
    p_metadata := jsonb_build_object(
      'task_title', v_task_title,
      'task_id', OLD.id,
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
$function$;
