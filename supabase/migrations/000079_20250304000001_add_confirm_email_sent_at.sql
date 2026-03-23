-- 컨펌 이메일 발송 완료 여부 컬럼 추가
-- 검토(REVIEW) + 승인(APPROVED) 업무에서 담당자가 관리자 전원에게 컨펌 이메일 발송 후 버튼 비노출 판단용

ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS confirm_email_sent_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.tasks.confirm_email_sent_at IS '컨펌 이메일 발송 완료 일시. null이면 미발송, 값이 있으면 발송 완료(버튼 비노출)';
