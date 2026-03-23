import supabase from "@/lib/supabase";

export type EmailTemplateType = {
  id: string;
  code: string;
  label: string;
  display_order: number;
};

export type EmailTemplate = {
  id: string;
  type_code: string;
  subject_template: string;
  body_template: string;
};

export type EmailTemplateWithType = EmailTemplate & {
  email_template_types: EmailTemplateType | null;
};

/**
 * 컨펌 이메일 템플릿 목록 조회 (특허/표장)
 * 참고: email_templates, email_template_types 테이블은 마이그레이션 적용 후 타입 재생성 필요
 */
export async function getEmailTemplates(): Promise<EmailTemplateWithType[]> {
  const { data, error } = await supabase
    .from("email_templates")
    .select(`
      id,
      type_code,
      subject_template,
      body_template,
      email_template_types (
        id,
        code,
        label,
        display_order
      )
    `)
    .order("type_code", { ascending: true });

  if (error) {
    throw new Error(`템플릿 조회 실패: ${error.message}`);
  }

  return (data || []) as EmailTemplateWithType[];
}

/**
 * 타입 코드로 템플릿 조회
 */
export async function getEmailTemplateByTypeCode(
  typeCode: string,
): Promise<EmailTemplate | null> {
  const { data, error } = await supabase
    .from("email_templates")
    .select("id, type_code, subject_template, body_template")
    .eq("type_code", typeCode)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`템플릿 조회 실패: ${error.message}`);
  }

  return data as EmailTemplate;
}

/**
 * 컨펌 이메일 발송 (RPC → net.http_post → Edge Function)
 * send-task-reference-email 패턴: 브라우저 fetch 대신 Postgres가 Edge Function 호출하여
 * FunctionsFetchError 회피
 */
export async function sendConfirmEmail(params: {
  taskId: string;
  subject: string;
  htmlBody: string;
  attachment?: { url: string; fileName: string; outputFileName?: string };
}): Promise<{ success: boolean; message?: string; sentCount?: number; totalCount?: number }> {
  const { data, error } = await supabase.rpc("send_confirm_email_rpc", {
    p_task_id: params.taskId,
    p_subject: params.subject,
    p_html_body: params.htmlBody,
    p_attachment: params.attachment ?? null,
  });

  if (error) {
    throw new Error(error.message || "컨펌 이메일 발송 실패");
  }

  const result = data as { success?: boolean; message?: string; sentCount?: number; totalCount?: number } | null;
  return {
    success: result?.success ?? true,
    message: result?.message ?? "컨펌 이메일 발송 요청이 접수되었습니다.",
    sentCount: result?.sentCount,
    totalCount: result?.totalCount,
  };
}
