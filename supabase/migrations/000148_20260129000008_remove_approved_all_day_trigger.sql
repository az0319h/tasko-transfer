-- ============================================================================
-- Remove Approved Schedule All-Day Trigger
-- APPROVED 상태일 때 일정을 종일로 변경하는 트리거 제거
-- ============================================================================
-- APPROVED 상태가 되어도 일정이 그대로 유지되어야 함 (종일로 변경하지 않음)
-- 사용자가 드래그 앤 드롭하고 늘린 시간 그대로 유지
-- ============================================================================

-- 트리거 제거
DROP TRIGGER IF EXISTS trigger_update_schedule_on_approved ON public.tasks;

-- 트리거 함수 제거 (다른 곳에서 사용하지 않으므로)
DROP FUNCTION IF EXISTS public.update_schedule_on_approved();
