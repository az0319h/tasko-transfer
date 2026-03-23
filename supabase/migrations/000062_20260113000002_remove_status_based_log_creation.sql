-- Remove status-based log creation completely
-- 상태 기반 로그 생성 함수를 완전히 제거 (파일 업로드 기반으로 전환 완료)

-- 1. Deprecated 함수 완전 제거
DROP FUNCTION IF EXISTS public.create_task_chat_log_deprecated(UUID, task_status, UUID);

-- 2. 기존 상태 기반 로그 생성 트리거가 있다면 제거 (확인용)
-- 주의: tasks 테이블에 상태 변경 시 로그 생성 트리거가 있다면 제거해야 함
-- 하지만 현재는 API에서 호출하는 방식이므로 트리거는 없을 것으로 예상됨

-- 3. 확인용 쿼리 (실제로는 실행하지 않음, 주석 처리)
-- SELECT trigger_name FROM information_schema.triggers 
-- WHERE event_object_table = 'tasks' 
-- AND trigger_name LIKE '%log%';

-- 4. 주석 추가
COMMENT ON FUNCTION public.create_chat_log_on_file_upload() IS '파일 업로드 기반 채팅 로그 생성 함수. 상태 기반 로그 생성은 완전히 제거되었으며, 이제 파일이 포함된 전송만 로그를 생성합니다.';
