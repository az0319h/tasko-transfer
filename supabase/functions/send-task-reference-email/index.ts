/**
 * send-task-reference-email
 *
 * ## 개요
 * 업무에 참조자로 추가되거나 참조 중인 업무의 상태가 변경될 때 참조자에게 이메일을 발송합니다.
 *
 * ## 호출 방식
 * - DB 트리거 (task_references insert 등) 또는 HTTP POST
 *
 * ## 이벤트
 * - REFERENCE_ADDED: 참조자 추가 시
 * - STATUS_CHANGED: 업무 상태 변경 시
 *
 * ## 필수 환경 변수
 * - SMTP_USER, SMTP_PASS, FRONTEND_URL
 * - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * ## 요청 (Request)
 * - Body: { eventType?, taskId, taskTitle, referenceEmails, ... }
 *
 * ## 응답 (Response)
 * - 200/207: { success, message, results }
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const nodemailer = await import("npm:nodemailer@^6.9.8");

type ReferenceEmailEventType = "REFERENCE_ADDED" | "STATUS_CHANGED";

interface ReferenceEmailRequest {
  /** 이벤트 유형. 미지정 시 REFERENCE_ADDED로 처리 */
  eventType?: ReferenceEmailEventType;
  taskId: string;
  taskTitle: string;
  taskDescription?: string;
  clientName?: string;
  dueDate?: string;
  assignerName?: string;
  assignerEmail?: string;
  assigneeName?: string;
  assigneeEmail?: string;
  /** STATUS_CHANGED 전용: 이전/새 상태, 변경자명 */
  oldStatus?: string;
  newStatus?: string;
  changerName?: string;
  referenceEmails: Array<{ email: string; name: string }>;
}

// Email template for reference notification
function getReferenceEmailTemplate(
  data: ReferenceEmailRequest,
  referenceName: string,
): { subject: string; html: string } {
  const frontendUrlEnv = Deno.env.get("FRONTEND_URL");
  const appUrl = frontendUrlEnv || "http://localhost:5173";
  const taskLink = `${appUrl}/tasks/${data.taskId}`;

  const assignerName = data.assignerName || "할당자";
  const assigneeName = data.assigneeName || "담당자";
  const dueDateText = data.dueDate
    ? new Date(data.dueDate).toLocaleDateString("ko-KR")
    : "미정";

  const subject = `[Tasko] 업무에 참조자로 추가되었습니다(${data.taskTitle})`;
  const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f7;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden;">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 32px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #1d1d1f; letter-spacing: -0.5px;">Tasko</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 0 40px 40px;">
              <h2 style="margin: 0 0 24px; font-size: 20px; font-weight: 600; color: #1d1d1f; line-height: 1.4;">${referenceName}님, 업무에 참조자로 추가되었습니다</h2>
              
              <div style="margin: 0 0 24px; padding: 16px; background-color: #f5f5f7; border-radius: 8px;">
                <p style="margin: 0 0 8px; font-size: 14px; line-height: 1.5; color: #6e6e73;">
                  참조자는 업무 진행 상황을 확인하고 채팅에 참여할 수 있습니다.
                </p>
                <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #6e6e73;">
                  업무 상태 변경, 일정 관리, 알림 등은 담당자만 가능합니다.
                </p>
              </div>
              
              <div style="margin: 0 0 32px;">
                ${data.clientName ? `<p style="margin: 0 0 12px; font-size: 16px; line-height: 1.6; color: #1d1d1f;"><strong style="color: #6e6e73;">고객명:</strong> ${data.clientName}</p>` : ""}
                <p style="margin: 0 0 12px; font-size: 16px; line-height: 1.6; color: #1d1d1f;"><strong style="color: #6e6e73;">지시사항:</strong> ${data.taskTitle}</p>
                ${data.taskDescription ? `<p style="margin: 0 0 12px; font-size: 16px; line-height: 1.6; color: #1d1d1f;"><strong style="color: #6e6e73;">설명:</strong> ${data.taskDescription}</p>` : ""}
                <p style="margin: 0 0 12px; font-size: 16px; line-height: 1.6; color: #1d1d1f;"><strong style="color: #6e6e73;">마감일:</strong> ${dueDateText}</p>
                <p style="margin: 0 0 12px; font-size: 16px; line-height: 1.6; color: #1d1d1f;"><strong style="color: #6e6e73;">지시자:</strong> ${assignerName}${data.assignerEmail ? ` (${data.assignerEmail})` : ""}</p>
                <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #1d1d1f;"><strong style="color: #6e6e73;">담당자:</strong> ${assigneeName}${data.assigneeEmail ? ` (${data.assigneeEmail})` : ""}</p>
              </div>
              
              <!-- CTA Button -->
              <table role="presentation" style="margin: 0 0 32px;">
                <tr>
                  <td style="border-radius: 8px; background-color: #000000; text-align: center;">
                    <a href="${taskLink}" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none;">업무 확인하기</a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 8px; font-size: 14px; line-height: 1.5; color: #6e6e73;">
                버튼이 작동하지 않으면 아래 링크를 복사하여 브라우저에 붙여넣으세요:
              </p>
              <p style="margin: 0; padding: 12px; background-color: #f5f5f7; border-radius: 6px; font-size: 13px; color: #6e6e73; word-break: break-all;">
                ${taskLink}
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 32px 40px; background-color: #fafafa; text-align: center;">
              <p style="margin: 0 0 4px; font-size: 13px; color: #86868b;">
                © 2025 Tasko. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return { subject, html };
}

// STATUS_CHANGED: 업무 상태 변경 시 참조자 알림
function getStatusChangedEmailTemplate(
  data: ReferenceEmailRequest,
  referenceName: string,
): { subject: string; html: string } {
  const frontendUrlEnv = Deno.env.get("FRONTEND_URL");
  const appUrl = frontendUrlEnv || "http://localhost:5173";
  const taskLink = `${appUrl}/tasks/${data.taskId}`;

  const statusLabels: Record<string, string> = {
    ASSIGNED: "할당됨",
    IN_PROGRESS: "진행 중",
    WAITING_CONFIRM: "확인 대기",
    APPROVED: "승인됨",
    REJECTED: "거부됨",
  };

  const oldLabel = statusLabels[data.oldStatus || ""] || data.oldStatus || "알 수 없음";
  const newLabel = statusLabels[data.newStatus || ""] || data.newStatus || "알 수 없음";
  const changerName = data.changerName || "시스템";
  const assignerName = data.assignerName || "할당자";
  const assigneeName = data.assigneeName || "담당자";
  const dueDateText = data.dueDate
    ? new Date(data.dueDate).toLocaleDateString("ko-KR")
    : "미정";

  const subject = `[Tasko] 업무 상태가 변경되었습니다(${data.taskTitle})`;
  const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f7;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden;">
          <tr>
            <td style="padding: 40px 40px 32px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #1d1d1f; letter-spacing: -0.5px;">Tasko</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 40px;">
              <h2 style="margin: 0 0 24px; font-size: 20px; font-weight: 600; color: #1d1d1f; line-height: 1.4;">${referenceName}님, 참조 중인 업무의 상태가 변경되었습니다</h2>
              <div style="margin: 0 0 24px; padding: 16px; background-color: #f0f9ff; border-radius: 8px; border-left: 4px solid #0ea5e9;">
                <p style="margin: 0 0 8px; font-size: 16px; line-height: 1.5; color: #1d1d1f;">
                  <strong>상태 변경:</strong> ${oldLabel} → ${newLabel}
                </p>
                <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #6e6e73;">
                  변경자: ${changerName}
                </p>
              </div>
              <div style="margin: 0 0 32px;">
                ${data.clientName ? `<p style="margin: 0 0 12px; font-size: 16px; line-height: 1.6; color: #1d1d1f;"><strong style="color: #6e6e73;">고객명:</strong> ${data.clientName}</p>` : ""}
                <p style="margin: 0 0 12px; font-size: 16px; line-height: 1.6; color: #1d1d1f;"><strong style="color: #6e6e73;">지시사항:</strong> ${data.taskTitle}</p>
                <p style="margin: 0 0 12px; font-size: 16px; line-height: 1.6; color: #1d1d1f;"><strong style="color: #6e6e73;">마감일:</strong> ${dueDateText}</p>
                <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #1d1d1f;"><strong style="color: #6e6e73;">지시자:</strong> ${assignerName} / <strong style="color: #6e6e73;">담당자:</strong> ${assigneeName}</p>
              </div>
              <table role="presentation" style="margin: 0 0 32px;">
                <tr>
                  <td style="border-radius: 8px; background-color: #000000; text-align: center;">
                    <a href="${taskLink}" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none;">업무 확인하기</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 8px; font-size: 14px; line-height: 1.5; color: #6e6e73;">
                버튼이 작동하지 않으면 아래 링크를 복사하여 브라우저에 붙여넣으세요:
              </p>
              <p style="margin: 0; padding: 12px; background-color: #f5f5f7; border-radius: 6px; font-size: 13px; color: #6e6e73; word-break: break-all;">${taskLink}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 40px; background-color: #fafafa; text-align: center;">
              <p style="margin: 0 0 4px; font-size: 13px; color: #86868b;">© 2025 Tasko. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return { subject, html };
}

// Send email function with retry logic
async function sendEmail(
  transporter: any,
  to: string,
  subject: string,
  html: string,
  maxRetries: number = 3,
): Promise<{ success: boolean; error?: string }> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await transporter.sendMail({
        from: Deno.env.get("SMTP_USER"),
        to,
        subject,
        html,
      });
      return { success: true };
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        // Wait before retry (exponential backoff)
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  return {
    success: false,
    error: lastError?.message || "Unknown error",
  };
}

// Main handler
Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    // Parse request body
    const emailData: ReferenceEmailRequest = await req.json();
    const eventType: ReferenceEmailEventType = emailData.eventType || "REFERENCE_ADDED";

    // --- 요청 검증 ---
    if (
      !emailData.taskId ||
      !emailData.taskTitle ||
      !emailData.referenceEmails ||
      emailData.referenceEmails.length === 0
    ) {
      return new Response(
        JSON.stringify({ error: "Missing required fields (taskId, taskTitle, referenceEmails)" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    // --- SMTP/Supabase 클라이언트 설정 ---
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");

    if (!smtpUser || !smtpPass) {
      console.error("[send-task-reference-email] SMTP credentials not configured");
      return new Response(JSON.stringify({ error: "SMTP credentials not configured" }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Create nodemailer transporter
    const transporter = nodemailer.default.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    // Create Supabase client for logging
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[send-task-reference-email] Supabase credentials not configured");
      return new Response(
        JSON.stringify({ error: "Supabase credentials not configured" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // --- 참조자별 이메일 발송 및 email_logs 기록 ---
    const results = await Promise.all(
      emailData.referenceEmails.map(async (reference) => {
        const { subject, html } =
          eventType === "STATUS_CHANGED"
            ? getStatusChangedEmailTemplate(emailData, reference.name)
            : getReferenceEmailTemplate(emailData, reference.name);

        const result = await sendEmail(transporter, reference.email, subject, html);

        const logStatus = result.success ? "sent" : "failed";
        const sentAt = result.success ? new Date().toISOString() : null;

        // Log email attempt
        const { error: logError } = await supabase.from("email_logs").insert({
          task_id: emailData.taskId,
          recipient_email: reference.email,
          recipient_name: reference.name,
          subject,
          status: logStatus,
          error_message: result.error || null,
          sent_at: sentAt,
        });

        if (logError) {
          console.error(`[send-task-reference-email] Failed to log email for ${reference.email}:`, logError);
        }

        return { ...result, recipient: reference.email };
      }),
    );

    // Check if all emails were sent successfully
    const allSuccess = results.every((r) => r.success);
    const failedRecipients = results.filter((r) => !r.success).map((r) => r.recipient);

    return new Response(
      JSON.stringify({
        success: allSuccess,
        message: allSuccess
          ? "Reference emails sent successfully"
          : `Some emails failed: ${failedRecipients.join(", ")}`,
        results,
      }),
      {
        status: allSuccess ? 200 : 207, // 207 Multi-Status for partial success
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (error) {
    console.error("[send-task-reference-email] Error sending email:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
});
