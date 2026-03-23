-- send_confirm_email_rpc: 하드코딩된 service_role 키 제거 → current_setting 사용
-- 기존 20250304000005에서 이미 적용된 경우, 이 마이그레이션은 idempotent하게 동일 로직 적용

CREATE OR REPLACE FUNCTION public.send_confirm_email_rpc(
  p_task_id UUID,
  p_subject TEXT,
  p_html_body TEXT,
  p_attachment JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task RECORD;
  v_function_url TEXT;
  v_service_role_key TEXT;
  v_base_url TEXT;
  v_request_body JSONB;
  v_request_id BIGINT;
BEGIN
  v_base_url := NULLIF(TRIM(current_setting('app.supabase_function_base_url', true)), '');
  IF v_base_url IS NULL OR v_base_url = '' THEN
    RAISE EXCEPTION 'app.supabase_function_base_url가 설정되지 않았습니다. ALTER DATABASE postgres SET app.supabase_function_base_url = ''https://your-project.supabase.co/functions/v1''; 로 설정하세요.';
  END IF;
  v_function_url := rtrim(v_base_url, '/') || '/send-confirm-email';

  v_service_role_key := NULLIF(TRIM(current_setting('app.supabase_service_role_key', true)), '');
  IF v_service_role_key IS NULL OR v_service_role_key = '' THEN
    RAISE EXCEPTION 'app.supabase_service_role_key가 설정되지 않았습니다. Supabase Dashboard > Settings > API > service_role key를 ALTER DATABASE postgres SET app.supabase_service_role_key = ''your-key''; 로 설정하세요.';
  END IF;

  -- 업무 조회 및 권한 확인 (담당자만 호출 가능)
  SELECT id, assignee_id, task_category, task_status
  INTO v_task
  FROM public.tasks
  WHERE id = p_task_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '업무를 찾을 수 없습니다.';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  IF v_task.assignee_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION '담당자만 컨펌 이메일을 발송할 수 있습니다.';
  END IF;

  IF v_task.task_category <> 'REVIEW' OR v_task.task_status <> 'APPROVED' THEN
    RAISE EXCEPTION '검토·승인 상태의 업무에만 컨펌 이메일을 발송할 수 있습니다.';
  END IF;

  -- Edge Function 요청 바디 구성
  v_request_body := jsonb_build_object(
    'taskId', p_task_id::TEXT,
    'subject', p_subject,
    'htmlBody', p_html_body,
    'attachment', COALESCE(p_attachment, 'null'::jsonb)
  );

  -- send-task-reference-email과 동일하게 net.http_post로 호출
  SELECT net.http_post(
    url := v_function_url,
    body := v_request_body,
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    )
  ) INTO v_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', '컨펌 이메일 발송 요청이 접수되었습니다.',
    'requestId', v_request_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Edge Function 호출 실패: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION public.send_confirm_email_rpc(UUID, TEXT, TEXT, JSONB) IS
  'send-confirm-email Edge Function을 net.http_post로 호출. 브라우저 fetch 실패(FunctionsFetchError) 회피. send-task-reference-email 패턴.';

-- RLS: authenticated 사용자만 호출 가능 (함수 내부에서 담당자 여부 검사)
GRANT EXECUTE ON FUNCTION public.send_confirm_email_rpc(UUID, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_confirm_email_rpc(UUID, TEXT, TEXT, JSONB) TO service_role;
