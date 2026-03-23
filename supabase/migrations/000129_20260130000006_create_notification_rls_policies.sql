-- ============================================================================
-- 알림 테이블 RLS 정책 설정
-- ============================================================================
-- 목적: notifications 테이블에 RLS 정책 설정
-- 
-- 작업 내용:
-- 1. RLS 활성화
-- 2. SELECT 정책: 사용자는 자신의 알림만 조회 가능
-- 3. INSERT 정책: 시스템만 알림 생성 가능 (SECURITY DEFINER 함수 사용)
-- 4. UPDATE 정책: 사용자는 자신의 알림만 읽음 처리 가능
-- 5. DELETE 정책: 사용자는 자신의 알림만 삭제 가능 (선택사항)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. RLS 활성화
-- ----------------------------------------------------------------------------

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2. SELECT 정책: 사용자는 자신의 알림만 조회 가능
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own"
ON public.notifications
FOR SELECT
USING ((SELECT auth.uid()) = user_id);

-- ----------------------------------------------------------------------------
-- 3. INSERT 정책: 시스템만 알림 생성 가능
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER 함수를 통해서만 알림 생성 가능하도록 설정
-- 일반 사용자는 직접 INSERT 불가

DROP POLICY IF EXISTS "notifications_insert_system_only" ON public.notifications;
CREATE POLICY "notifications_insert_system_only"
ON public.notifications
FOR INSERT
WITH CHECK (false);  -- 일반 사용자는 직접 INSERT 불가 (SECURITY DEFINER 함수만 가능)

-- ----------------------------------------------------------------------------
-- 4. UPDATE 정책: 사용자는 자신의 알림만 읽음 처리 가능
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own"
ON public.notifications
FOR UPDATE
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

-- ----------------------------------------------------------------------------
-- 5. DELETE 정책: 사용자는 자신의 알림만 삭제 가능 (선택사항)
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
CREATE POLICY "notifications_delete_own"
ON public.notifications
FOR DELETE
USING ((SELECT auth.uid()) = user_id);

-- ----------------------------------------------------------------------------
-- 6. 주석 추가
-- ----------------------------------------------------------------------------

COMMENT ON POLICY "notifications_select_own" ON public.notifications IS 
'사용자는 자신의 알림만 조회 가능';

COMMENT ON POLICY "notifications_insert_system_only" ON public.notifications IS 
'일반 사용자는 직접 알림 생성 불가. SECURITY DEFINER 함수를 통해서만 생성 가능';

COMMENT ON POLICY "notifications_update_own" ON public.notifications IS 
'사용자는 자신의 알림만 읽음 처리 가능';

COMMENT ON POLICY "notifications_delete_own" ON public.notifications IS 
'사용자는 자신의 알림만 삭제 가능';

COMMIT;
