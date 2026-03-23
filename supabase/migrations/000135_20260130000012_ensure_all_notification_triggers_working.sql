-- ============================================================================
-- 알림 트리거 최종 확인 및 재생성
-- ============================================================================
-- 목적: Task 생성/삭제 시 담당자에게 알림이 정상적으로 생성되도록 모든 트리거 확인 및 재생성
-- 
-- 요구사항:
-- 1. Task 생성 시 담당자에게 TASK_CREATED 알림 1개 생성 (새로운 row)
-- 2. Task 삭제 시 담당자에게 TASK_DELETED 알림 1개 생성 (새로운 row, 기존 알림을 덮지 않음)
-- 3. 각 알림은 독립적인 row로 생성되어야 함
-- 4. 알림 count가 정확히 증가해야 함
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Task 생성 트리거 확인 및 재생성
-- ----------------------------------------------------------------------------

-- 기존 트리거 제거
DROP TRIGGER IF EXISTS trigger_create_task_created_notification ON public.tasks;

-- 트리거 재생성
CREATE TRIGGER trigger_create_task_created_notification
  AFTER INSERT ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.create_task_created_notification();

-- 트리거 코멘트
COMMENT ON TRIGGER trigger_create_task_created_notification ON public.tasks IS 
'Task 생성 시 담당자에게 TASK_CREATED 알림을 생성하는 트리거. 새로운 알림 row가 생성되고 알림 count가 증가합니다.';

-- ----------------------------------------------------------------------------
-- 2. Task 삭제 트리거 확인 및 재생성
-- ----------------------------------------------------------------------------

-- 기존 트리거 제거
DROP TRIGGER IF EXISTS trigger_create_task_deleted_notification ON public.tasks;

-- 트리거 재생성
CREATE TRIGGER trigger_create_task_deleted_notification
  AFTER DELETE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.create_task_deleted_notification();

-- 트리거 코멘트
COMMENT ON TRIGGER trigger_create_task_deleted_notification ON public.tasks IS 
'Task 삭제 시 담당자에게 TASK_DELETED 알림을 생성하는 트리거. 새로운 알림 row가 생성되고 알림 count가 증가합니다. 기존 알림을 덮지 않고 추가됩니다.';

-- ----------------------------------------------------------------------------
-- 3. 함수 확인 (최신 버전으로 업데이트)
-- ----------------------------------------------------------------------------

-- Task 생성 알림 함수 확인 (이미 최신 버전)
-- 함수는 20260130000003_create_notification_triggers.sql에서 생성됨

-- Task 삭제 알림 함수 확인 (이미 최신 버전)
-- 함수는 20260130000009_fix_task_deleted_notification_task_id.sql에서 수정됨

COMMIT;
