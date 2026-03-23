-- ============================================================================
-- send_task_created_email ?⑥닔 ?섏젙: project_id ?쒓굅, client_name ?ъ슜
-- ============================================================================
-- 紐⑹쟻: Task ?앹꽦 ???대찓??諛쒖넚 ?⑥닔瑜??꾨줈?앺듃 援ъ“ ?쒓굅??留욊쾶 ?섏젙
-- 
-- 臾몄젣:
-- - send_task_created_email ?⑥닔媛 議댁옱?섏? ?딅뒗 projects ?뚯씠釉?李몄“
-- - project_id 而щ읆 李몄“ (?대? ?쒓굅??
-- - ?섎せ??Edge Function URL ?ъ슜
-- 
-- ?닿껐:
-- - projects ?뚯씠釉?李몄“ ?쒓굅
-- - project_id 而щ읆 李몄“ ?쒓굅
-- - client_name ?ъ슜?섎룄濡?蹂寃?-- - ?щ컮瑜?Edge Function URL ?ъ슜
-- - Edge Function??clientName ?꾩넚
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- send_task_created_email ?⑥닔 ?섏젙
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.send_task_created_email()
RETURNS TRIGGER AS $$$
DECLARE
  assigner_email TEXT;
  assignee_email TEXT;
  assigner_name TEXT;
  assignee_name TEXT;
  client_name TEXT;
  request_body JSONB;
  function_url TEXT;
  service_role_key TEXT;
  http_response_id BIGINT;
BEGIN
  -- 濡쒓퉭: ?몃━嫄??ㅽ뻾 ?뺤씤
  RAISE NOTICE '[EMAIL_TRIGGER] Task created: %', NEW.id;

  -- Get assigner and assignee emails and names from profiles
  SELECT email, COALESCE(full_name, email) INTO assigner_email, assigner_name
  FROM public.profiles
  WHERE id = NEW.assigner_id;

  SELECT email, COALESCE(full_name, email) INTO assignee_email, assignee_name
  FROM public.profiles
  WHERE id = NEW.assignee_id;

  -- Validate email addresses
  IF assigner_email IS NULL OR assignee_email IS NULL THEN
    RAISE WARNING '[EMAIL_TRIGGER] Missing email addresses: assigner=%, assignee=%', 
      assigner_email, assignee_email;
    RETURN NEW;
  END IF;

  -- Get client_name from task (project_id ????ъ슜)
  client_name := NEW.client_name;

  -- Build request body for Edge Function (project_id, project_title ?쒓굅, client_name 異붽?)
  request_body := jsonb_build_object(
    'eventType', 'TASK_CREATED',
    'taskId', NEW.id::TEXT,
    'assignerEmail', assigner_email,
    'assigneeEmail', assignee_email,
    'assignerName', assigner_name,
    'assigneeName', assignee_name,
    'taskTitle', NEW.title,
    'taskDescription', NEW.description,
    'clientName', COALESCE(client_name, ''),
    'dueDate', COALESCE(NEW.due_date::TEXT, ''),
    'recipients', ARRAY['assigner', 'assignee']
  );

  -- ?좑툘 二쇱쓽: Edge Function URL怨?Service Role Key???섎뱶肄붾뵫?섏뼱 ?덉뒿?덈떎.
  -- ?ㅻⅨ ?곗씠?곕쿋?댁뒪(媛쒕컻/?ㅽ뀒?댁쭠/?꾨줈?뺤뀡)???곸슜???뚮뒗 ?꾨옒 媛믩뱾???대떦 ?섍꼍??留욊쾶 蹂寃쏀빐???⑸땲??
  
  -- Edge Function URL: DB 설정에서 로드 (ALTER DATABASE postgres SET app.supabase_function_base_url = 'https://your-project.supabase.co/functions/v1';)
  function_url := rtrim(NULLIF(TRIM(current_setting('app.supabase_function_base_url', true)), ''), '/') || '/send-task-email';
  IF function_url IS NULL OR function_url = '' OR left(function_url, 4) != 'http' THEN
    RAISE WARNING 'app.supabase_function_base_url가 설정되지 않았습니다. 이메일 발송을 건너뜁니다.';
    RETURN NEW;
  END IF;

  -- Service Role Key: DB 설정에서 로드 (ALTER DATABASE postgres SET app.supabase_service_role_key = 'your-key';)
  service_role_key := NULLIF(TRIM(current_setting('app.supabase_service_role_key', true)), '');
  IF service_role_key IS NULL OR service_role_key = '' THEN
    RAISE WARNING 'app.supabase_service_role_key가 설정되지 않았습니다. 이메일 발송을 건너뜁니다.';
    RETURN NEW;
  END IF;

  RAISE NOTICE '[EMAIL_TRIGGER] Calling Edge Function: %', function_url;
  RAISE NOTICE '[EMAIL_TRIGGER] Request body: %', request_body;

  -- Call Edge Function via HTTP (non-blocking)
  -- ?щ컮瑜??쒓렇?덉쿂: net.http_post(url text, body jsonb, params jsonb, headers jsonb)
  SELECT net.http_post(
    url := function_url,
    body := request_body,
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', format('Bearer %s', service_role_key)
    )
  ) INTO http_response_id;

  RAISE NOTICE '[EMAIL_TRIGGER] HTTP request submitted with ID: %', http_response_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[EMAIL_TRIGGER] Failed to send task creation email notification: %', SQLERRM;
    RAISE WARNING '[EMAIL_TRIGGER] Error details: %', SQLSTATE;
    RETURN NEW;
END;
$$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update comments
COMMENT ON FUNCTION public.send_task_created_email() IS 
'Trigger function that sends email notifications when task is created via Edge Function. Uses hardcoded URL and Service Role Key. ?좑툘 二쇱쓽: ?ㅻⅨ ?곗씠?곕쿋?댁뒪 ?섍꼍???곸슜???뚮뒗 ?⑥닔 ?대????섎뱶肄붾뵫??媛믪쓣 蹂寃쏀빐???⑸땲?? Includes enhanced logging for debugging. Updated to use client_name instead of project_id/project_title.';

COMMIT;
