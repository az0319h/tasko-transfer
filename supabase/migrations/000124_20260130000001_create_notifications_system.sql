-- ============================================================================
-- 알림 시스템 테이블 및 타입 생성
-- ============================================================================
-- 목적: notifications 테이블과 notification_type enum 생성
-- 
-- 작업 내용:
-- 1. notification_type enum 생성
-- 2. notifications 테이블 생성
-- 3. 인덱스 생성 (성능 최적화)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. notification_type enum 생성
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type 
    WHERE typname = 'notification_type'
  ) THEN
    CREATE TYPE notification_type AS ENUM (
      'TASK_CREATED',
      'TASK_STATUS_CHANGED',
      'TASK_DELETED',
      'TASK_DUE_DATE_EXCEEDED',
      'TASK_DUE_DATE_APPROACHING'
    );
    
    COMMENT ON TYPE notification_type IS '알림 타입: TASK_CREATED(작업 생성), TASK_STATUS_CHANGED(상태 변경), TASK_DELETED(작업 삭제), TASK_DUE_DATE_EXCEEDED(마감일 초과), TASK_DUE_DATE_APPROACHING(마감일 임박)';
    
    RAISE NOTICE 'notification_type ENUM 타입을 생성했습니다.';
  ELSE
    RAISE NOTICE 'notification_type ENUM 타입이 이미 존재합니다.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. notifications 테이블 생성
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  notification_type notification_type NOT NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 3. 인덱스 생성 (성능 최적화)
-- ----------------------------------------------------------------------------

-- 사용자별 조회 최적화
CREATE INDEX IF NOT EXISTS idx_notifications_user_id 
  ON public.notifications(user_id);

-- 읽지 않은 알림 조회 최적화 (복합 인덱스)
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_is_read 
  ON public.notifications(user_id, is_read) 
  WHERE is_read = false;

-- 시간순 정렬 최적화
CREATE INDEX IF NOT EXISTS idx_notifications_created_at 
  ON public.notifications(created_at DESC);

-- Task별 알림 조회 최적화
CREATE INDEX IF NOT EXISTS idx_notifications_task_id 
  ON public.notifications(task_id) 
  WHERE task_id IS NOT NULL;

-- notification_type별 조회 최적화
CREATE INDEX IF NOT EXISTS idx_notifications_notification_type 
  ON public.notifications(notification_type);

-- metadata JSONB 필드 조회 최적화 (GIN 인덱스)
CREATE INDEX IF NOT EXISTS idx_notifications_metadata 
  ON public.notifications USING GIN (metadata);

-- ----------------------------------------------------------------------------
-- 4. 주석 추가
-- ----------------------------------------------------------------------------

COMMENT ON TABLE public.notifications IS '알림 테이블: 사용자에게 전송되는 모든 알림을 저장';
COMMENT ON COLUMN public.notifications.user_id IS '알림 수신자 (profiles.id 참조)';
COMMENT ON COLUMN public.notifications.notification_type IS '알림 타입 (notification_type enum)';
COMMENT ON COLUMN public.notifications.task_id IS '관련 Task ID (nullable, Task와 관련 없는 알림의 경우 NULL)';
COMMENT ON COLUMN public.notifications.title IS '알림 제목';
COMMENT ON COLUMN public.notifications.message IS '알림 메시지';
COMMENT ON COLUMN public.notifications.is_read IS '읽음 여부 (기본값: false)';
COMMENT ON COLUMN public.notifications.read_at IS '읽은 시간 (nullable)';
COMMENT ON COLUMN public.notifications.metadata IS '추가 메타데이터 (JSONB, 예: 상태 변경 전/후, days_remaining 등)';
COMMENT ON COLUMN public.notifications.created_at IS '알림 생성 시간';

COMMIT;
