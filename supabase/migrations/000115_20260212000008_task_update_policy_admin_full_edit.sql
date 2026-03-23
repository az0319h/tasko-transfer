-- ============================================================================
-- Task 수정 정책 정리 (관리자 수정 권한)
-- ============================================================================
-- 목적: 관리자(Admin)가 Task 상세 페이지에서 제목, 고객명, 마감일 등 수정 가능하도록
--       기존 "관리자는 is_public만 수정 가능" 제한이 API 레벨에 있어 DB 변경 불필요
--       이 마이그레이션은 정책 문서화 및 추적용
--
-- 적용된 정책 (API 레벨, src/api/task.ts updateTask):
-- - 관리자: title, client_name, due_date, is_public, send_email_to_client 수정 가능
-- - 지시자: title, client_name, due_date 수정 가능
-- - 담당자: send_email_to_client 수정 가능
-- - is_public: 공개 설정 전용, 관리자만 변경 가능
--
-- RLS: tasks_update_assigner_or_assignee 정책이 이미 admin 수정 허용
-- ============================================================================

-- 정책 문서화를 위한 테이블 코멘트 업데이트 (선택적)
COMMENT ON COLUMN public.tasks.is_public IS 'Task 공개 여부. 관리자만 변경 가능. true일 경우 모든 사용자가 읽기 전용으로 접근 가능';
