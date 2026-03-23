/**
 * send-confirm-email
 *
 * ## 개요
 * 검토·승인 업무의 담당자가 관리자 전원 + 담당자(assignee)에게 컨펌 이메일을 발송합니다.
 * DOCX 첨부 시 ConvertAPI로 PDF 변환 후 발송합니다.
 * 첨부 URL은 SSRF 방어를 위해 HTTPS + Supabase 도메인만 허용합니다.
 *
 * ## 호출 방식
 * - HTTP POST (프론트엔드에서 직접 호출)
 *
 * ## 필수 환경 변수
 * - SMTP_USER, SMTP_PASS, CONVERTAPI_SECRET (DOCX 첨부 시)
 * - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * ## 요청 (Request)
 * - Body: { taskId, subject, htmlBody, attachment?: { url, fileName, outputFileName? } }
 *
 * ## 응답 (Response)
 * - 200/207: { success, message, sentCount, totalCount }
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const nodemailer = await import("npm:nodemailer@^6.9.8");

interface ConfirmEmailRequest {
  taskId: string;
  subject: string;
  htmlBody: string;
  attachment?: { url: string; fileName: string; outputFileName?: string };
}

type AttachmentInput = { url: string; fileName: string } | { content: Uint8Array; fileName: string };

function toPdfAttachmentFileName(docxFileName: string): string {
  const withoutExt = docxFileName.replace(/\.docx?$/i, "");
  const withoutSuffix = withoutExt.replace(/_초\d+$/, "");
  return `${withoutSuffix}.pdf`;
}

/**
 * 첨부 URL SSRF 방어: HTTPS + Supabase 도메인만 허용
 * - 프로덕션(SUPABASE_URL=https): HTTPS만 허용
 * - 로컬(SUPABASE_URL=http): http 허용 (로컬 Storage 대응)
 * @param rawUrl 검증할 URL
 * @param supabaseUrl 프로젝트 SUPABASE_URL (허용할 호스트 추출용)
 * @throws Error 프로토콜 또는 도메인이 허용 목록에 없을 때
 */
function assertAllowedAttachmentUrl(rawUrl: string, supabaseUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("첨부 URL 형식이 올바르지 않습니다.");
  }
  const supabaseParsed = new URL(supabaseUrl);
  const allowHttp = supabaseParsed.protocol === "http:";
  if (parsed.protocol !== "https:" && !(allowHttp && parsed.protocol === "http:")) {
    throw new Error("첨부 URL은 HTTPS만 허용됩니다.");
  }
  const supabaseHost = supabaseParsed.hostname;
  const allowedHosts = new Set([supabaseHost]);
  if (!allowedHosts.has(parsed.hostname)) {
    throw new Error("허용되지 않은 첨부 URL 도메인입니다.");
  }
  return parsed.toString();
}

async function convertDocxToPdfViaConvertAPI(
  docxUrl: string,
  docxFileName: string,
): Promise<{ content: Uint8Array; fileName: string }> {
  const apiSecret = Deno.env.get("CONVERTAPI_SECRET");
  if (!apiSecret) {
    throw new Error(
      "CONVERTAPI_SECRET 환경 변수가 설정되지 않았습니다. https://www.convertapi.com 에서 가입 후 API 시크릿을 발급받아 설정하세요.",
    );
  }

  const docxRes = await fetch(docxUrl);
  if (!docxRes.ok) {
    throw new Error(`DOCX 파일 다운로드 실패: ${docxRes.status}`);
  }
  const docxBytes = await docxRes.arrayBuffer();

  const form = new FormData();
  form.append("File", new Blob([docxBytes], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), docxFileName);

  const convertRes = await fetch("https://v2.convertapi.com/convert/docx/to/pdf", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiSecret}`,
      Accept: "application/json",
    },
    body: form,
  });

  if (!convertRes.ok) {
    const errText = await convertRes.text();
    throw new Error(`ConvertAPI 변환 실패 (${convertRes.status}): ${errText}`);
  }

  const result = (await convertRes.json()) as {
    Files?: Array<{ Url?: string; FileData?: string; FileName?: string }>;
  };
  const files = result?.Files;
  if (!files?.length) {
    throw new Error("ConvertAPI 응답에 변환된 파일이 없습니다.");
  }

  let pdfBytes: Uint8Array;
  const firstFile = files[0];
  if (firstFile.FileData) {
    // Base64 인코딩된 파일 (StoreFile=false 시)
    const binary = atob(firstFile.FileData);
    pdfBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) pdfBytes[i] = binary.charCodeAt(i);
  } else if (firstFile.Url) {
    const pdfRes = await fetch(firstFile.Url);
    if (!pdfRes.ok) throw new Error(`PDF 다운로드 실패: ${pdfRes.status}`);
    pdfBytes = new Uint8Array(await pdfRes.arrayBuffer());
  } else {
    throw new Error("ConvertAPI 응답에 파일 URL 또는 데이터가 없습니다.");
  }
  const pdfFileName = toPdfAttachmentFileName(docxFileName);
  return { content: pdfBytes, fileName: pdfFileName };
}

async function sendEmail(
  transporter: any,
  to: string,
  subject: string,
  html: string,
  attachment?: AttachmentInput,
  maxRetries = 3,
): Promise<{ success: boolean; error?: string }> {
  let lastError: Error | null = null;
  const mailOptions: any = {
    from: Deno.env.get("SMTP_USER"),
    to,
    subject,
    html,
  };
  if (attachment?.fileName) {
    if ("content" in attachment && attachment.content) {
      mailOptions.attachments = [{ filename: attachment.fileName, content: attachment.content }];
    } else if ("url" in attachment && attachment.url) {
      mailOptions.attachments = [{ filename: attachment.fileName, href: attachment.url }];
    }
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await transporter.sendMail(mailOptions);
      return { success: true };
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }
  return { success: false, error: lastError?.message || "Unknown error" };
}

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // POST만 허용 (405 Method Not Allowed)
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method Not Allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    // Authorization 헤더 검증 (service_role 호출만 허용)
    const authHeader = req.headers.get("Authorization");
    const expectedKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const expectedBearer = expectedKey ? `Bearer ${expectedKey}` : null;

    if (!authHeader || !expectedBearer || authHeader !== expectedBearer) {
      return new Response(
        JSON.stringify({ error: "인증 토큰이 필요하거나 유효하지 않습니다." }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body: ConfirmEmailRequest = await req.json();
    const { taskId, subject, htmlBody, attachment } = body;

    if (!taskId || !subject || !htmlBody) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: taskId, subject, htmlBody" }),
        { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
      );
    }

    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    if (!smtpUser || !smtpPass) {
      return new Response(
        JSON.stringify({ error: "SMTP credentials not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: "Supabase credentials not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // --- 업무·담당자 조회 ---
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("assignee_id")
      .eq("id", taskId)
      .single();

    if (taskError) {
      console.error("[send-confirm-email] Task fetch error:", taskError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch task" }),
        { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
      );
    }

    let assigneeEmail: string | null = null;
    if (task?.assignee_id) {
      const { data: assignee } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", task.assignee_id)
        .single();
      if (assignee?.email) assigneeEmail = assignee.email;
    }

    // --- 관리자 목록 조회 ---
    const { data: admins, error: adminsError } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("role", "admin")
      .eq("is_active", true)
      .not("email", "is", null);

    if (adminsError) {
      console.error("[send-confirm-email] Admin fetch error:", adminsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch admin list" }),
        { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
      );
    }

    const adminEmails = (admins || []).map((a) => a.email).filter(Boolean) as string[];
    const recipientEmails = [...new Set([...adminEmails, assigneeEmail].filter(Boolean))] as string[];
    if (recipientEmails.length === 0) {
      return new Response(
        JSON.stringify({ error: "No recipients found (admin or assignee)" }),
        { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
      );
    }

    const transporter = nodemailer.default.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user: smtpUser, pass: smtpPass },
    });

    // 템플릿에서 작성한 본문 그대로 전송 (추가 래핑/서식 없음)
    const html = htmlBody;

    // --- DOCX → PDF 변환 (ConvertAPI, .docx 첨부 시) ---
    let finalAttachment: AttachmentInput | undefined = attachment;
    if (attachment?.url) {
      try {
        attachment.url = assertAllowedAttachmentUrl(attachment.url, supabaseUrl);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "첨부 URL 검증 실패";
        return new Response(
          JSON.stringify({ error: "Invalid attachment URL", message: msg }),
          { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
        );
      }
    }
    if (attachment?.url && attachment?.fileName && /\.docx$/i.test(attachment.fileName)) {
      try {
        const converted = await convertDocxToPdfViaConvertAPI(attachment.url, attachment.fileName);
        finalAttachment = {
          content: converted.content,
          fileName: attachment.outputFileName || converted.fileName,
        };
      } catch (err) {
        console.error("[send-confirm-email] ConvertAPI 변환 실패:", err);
        return new Response(
          JSON.stringify({
            error: "DOCX→PDF 변환 실패",
            message: err instanceof Error ? err.message : "ConvertAPI 변환 중 오류가 발생했습니다.",
          }),
          { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
        );
      }
    }

    // --- 이메일 발송 및 confirm_email_sent_at 업데이트 ---
    const results = await Promise.all(
      recipientEmails.map((email) =>
        sendEmail(transporter, email, subject, html, finalAttachment).then((r) => ({ email, ...r })),
      ),
    );

    const allSuccess = results.every((r) => r.success);
    const failed = results.filter((r) => !r.success).map((r) => r.email);

    if (allSuccess) {
      const { error: updateError } = await supabase
        .from("tasks")
        .update({ confirm_email_sent_at: new Date().toISOString() })
        .eq("id", taskId);

      if (updateError) {
        console.error("[send-confirm-email] Failed to update task:", updateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: allSuccess,
        message: allSuccess ? "Emails sent successfully" : `Some failed: ${failed.join(", ")}`,
        sentCount: results.filter((r) => r.success).length,
        totalCount: recipientEmails.length,
      }),
      {
        status: allSuccess ? 200 : 207,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      },
    );
  } catch (error) {
    console.error("[send-confirm-email] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", message: (error as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
    );
  }
});

