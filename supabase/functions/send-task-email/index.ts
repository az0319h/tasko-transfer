/**
 * send-task-email
 *
 * ## 개요
 * Task 생성 또는 상태 변경 시 할당자/담당자에게 이메일을 발송합니다.
 * recipients 배열로 수신자를 지정 (assigner, assignee).
 *
 * ## 호출 방식
 * - DB 트리거 또는 HTTP POST
 *
 * ## 이벤트
 * - TASK_CREATED: 업무 할당 시
 * - STATUS_CHANGED: 상태 변경 시 (케이스 1, 5는 발송 스킵)
 *
 * ## 필수 환경 변수
 * - SMTP_USER, SMTP_PASS, FRONTEND_URL
 * - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * ## 요청 (Request)
 * - Body: { eventType, taskId, assignerEmail, assigneeEmail, taskTitle, recipients, ... }
 *
 * ## 응답 (Response)
 * - 200/207: { success, message, results }
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Import nodemailer for Deno
// Note: In production, use npm:nodemailer@^6.9.8
// For Deno, we'll use a compatible approach
const nodemailer = await import("npm:nodemailer@^6.9.8");

interface EmailRequest {
  eventType: "TASK_CREATED" | "STATUS_CHANGED";
  taskId: string;
  assignerEmail: string;
  assigneeEmail: string;
  assignerName?: string;
  assigneeName?: string;
  taskTitle: string;
  taskDescription?: string;
  clientName?: string;
  dueDate?: string;
  // Status change specific fields
  oldStatus?: string;
  newStatus?: string;
  changerId?: string;
  changerName?: string;
  // Recipients array: determines who receives the email
  recipients: ("assigner" | "assignee")[];
}

// Email template function
// Returns different templates based on event type and recipient role
function getEmailTemplate(
  data: EmailRequest,
  recipientRole: "assigner" | "assignee",
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

  // Task creation email templates
  if (data.eventType === "TASK_CREATED") {
    const assignerName = data.assignerName || "할당자";
    const assigneeName = data.assigneeName || "담당자";
    const dueDateText = data.dueDate ? new Date(data.dueDate).toLocaleDateString("ko-KR") : "미정";

    if (recipientRole === "assignee") {
      // Assignee receives: "○○님(assigner)이 당신에게 업무를 할당했습니다"
      const subject = `[Tasko] 새로운 업무가 할당되었습니다(${data.taskTitle})`;
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
              <h2 style="margin: 0 0 24px; font-size: 20px; font-weight: 600; color: #1d1d1f; line-height: 1.4;">${assignerName}님이 당신에게 업무를 할당했습니다</h2>
              
              <div style="margin: 0 0 32px;">
                ${data.clientName ? `<p style="margin: 0 0 12px; font-size: 16px; line-height: 1.6; color: #1d1d1f;"><strong style="color: #6e6e73;">고객명:</strong> ${data.clientName}</p>` : ""}
                <p style="margin: 0 0 12px; font-size: 16px; line-height: 1.6; color: #1d1d1f;"><strong style="color: #6e6e73;">지시사항:</strong> ${data.taskTitle}</p>
                ${data.taskDescription ? `<p style="margin: 0 0 12px; font-size: 16px; line-height: 1.6; color: #1d1d1f;"><strong style="color: #6e6e73;">설명:</strong> ${data.taskDescription}</p>` : ""}
                <p style="margin: 0 0 12px; font-size: 16px; line-height: 1.6; color: #1d1d1f;"><strong style="color: #6e6e73;">마감일:</strong> ${dueDateText}</p>
                <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #1d1d1f;"><strong style="color: #6e6e73;">할당자:</strong> ${assignerName} (${data.assignerEmail})</p>
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
    } else {
      // Assigner receives: "당신이 ○○님(assignee)에게 업무를 할당했습니다"
      const subject = `[Tasko] 업무 할당이 완료되었습니다(${data.taskTitle})`;
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
              <h2 style="margin: 0 0 24px; font-size: 20px; font-weight: 600; color: #1d1d1f; line-height: 1.4;">당신이 ${assigneeName}님에게 업무를 할당했습니다</h2>
              
              <div style="margin: 0 0 32px;">
                ${data.clientName ? `<p style="margin: 0 0 12px; font-size: 16px; line-height: 1.6; color: #1d1d1f;"><strong style="color: #6e6e73;">고객명:</strong> ${data.clientName}</p>` : ""}
                <p style="margin: 0 0 12px; font-size: 16px; line-height: 1.6; color: #1d1d1f;"><strong style="color: #6e6e73;">지시사항:</strong> ${data.taskTitle}</p>
                ${data.taskDescription ? `<p style="margin: 0 0 12px; font-size: 16px; line-height: 1.6; color: #1d1d1f;"><strong style="color: #6e6e73;">설명:</strong> ${data.taskDescription}</p>` : ""}
                <p style="margin: 0 0 12px; font-size: 16px; line-height: 1.6; color: #1d1d1f;"><strong style="color: #6e6e73;">마감일:</strong> ${dueDateText}</p>
                <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #1d1d1f;"><strong style="color: #6e6e73;">담당자:</strong> ${assigneeName} (${data.assigneeEmail})</p>
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
  }

  // Status change email templates
  if (data.eventType === "STATUS_CHANGED" && data.oldStatus && data.newStatus) {
    const oldStatusLabel = statusLabels[data.oldStatus] || data.oldStatus;
    const newStatusLabel = statusLabels[data.newStatus] || data.newStatus;
    const changerName = data.changerName || "시스템";

    // Determine message based on status transition and recipient role
    let statusMessage = "";
    if (data.oldStatus === "ASSIGNED" && data.newStatus === "IN_PROGRESS") {
      statusMessage =
        recipientRole === "assigner"
          ? `${data.assigneeName || "담당자"}님이 업무를 시작했습니다`
          : "업무를 시작했습니다";
    } else if (data.oldStatus === "IN_PROGRESS" && data.newStatus === "WAITING_CONFIRM") {
      statusMessage =
        recipientRole === "assigner"
          ? `${data.assigneeName || "담당자"}님이 업무 완료를 요청했습니다`
          : "업무 완료를 요청했습니다";
    } else if (data.oldStatus === "WAITING_CONFIRM" && data.newStatus === "APPROVED") {
      statusMessage =
        recipientRole === "assignee"
          ? `${data.assignerName || "할당자"}님이 업무를 승인했습니다`
          : "업무를 승인했습니다";
    } else if (data.oldStatus === "WAITING_CONFIRM" && data.newStatus === "REJECTED") {
      statusMessage =
        recipientRole === "assignee"
          ? `${data.assignerName || "할당자"}님이 업무를 반려했습니다`
          : "업무를 반려했습니다";
    } else if (data.oldStatus === "REJECTED" && data.newStatus === "IN_PROGRESS") {
      // REJECTED → IN_PROGRESS: 업무 재진행 시작 (assigner에게만 발송)
      statusMessage =
        recipientRole === "assigner"
          ? `${data.assigneeName || "담당자"}님이 업무를 다시 시작했습니다`
          : "업무를 다시 시작했습니다";
    } else {
      statusMessage = `상태가 ${oldStatusLabel}에서 ${newStatusLabel}로 변경되었습니다`;
    }

    // Determine subject based on status transition
    let subject = "";
    if (data.oldStatus === "IN_PROGRESS" && data.newStatus === "WAITING_CONFIRM") {
      // 케이스 2: 완료 요청
      subject = `[Tasko] 업무를 완료해서 당신에게 확인을 요청했습니다(${data.taskTitle})`;
    } else if (data.oldStatus === "WAITING_CONFIRM" && data.newStatus === "APPROVED") {
      // 케이스 3: 승인
      subject = `[Tasko] 당신의 업무가 승인되었습니다(${data.taskTitle})`;
    } else if (data.oldStatus === "WAITING_CONFIRM" && data.newStatus === "REJECTED") {
      // 케이스 4: 반려
      subject = `[Tasko] 당신의 업무가 반려처리 되었습니다(${data.taskTitle})`;
    } else {
      // 기타 케이스 (현재는 케이스 1, 5번은 이메일 전송 안 함)
      subject = `[Tasko] 업무 상태 변경(${data.taskTitle})`;
    }
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
              <h2 style="margin: 0 0 24px; font-size: 20px; font-weight: 600; color: #1d1d1f; line-height: 1.4;">${statusMessage}</h2>
              
              <div style="margin: 0 0 32px;">
                ${data.clientName ? `<p style="margin: 0 0 12px; font-size: 16px; line-height: 1.6; color: #1d1d1f;"><strong style="color: #6e6e73;">고객명:</strong> ${data.clientName}</p>` : ""}
                <p style="margin: 0 0 12px; font-size: 16px; line-height: 1.6; color: #1d1d1f;"><strong style="color: #6e6e73;">지시사항:</strong> ${data.taskTitle}</p>
                <p style="margin: 0 0 12px; font-size: 16px; line-height: 1.6; color: #1d1d1f;"><strong style="color: #6e6e73;">상태 변경:</strong> <span style="color: #dc2626;">${oldStatusLabel}</span> → <span style="color: #16a34a;">${newStatusLabel}</span></p>
                <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #1d1d1f;"><strong style="color: #6e6e73;">변경자:</strong> ${changerName}</p>
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

  // Fallback template (should not reach here)
  return {
    subject: `[Tasko] 업무 알림(${data.taskTitle})`,
    html: `<p>업무 알림입니다.</p>`,
  };
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
    const emailData: EmailRequest = await req.json();

    // --- 요청 검증 ---
    if (
      !emailData.taskId ||
      !emailData.eventType ||
      !emailData.assignerEmail ||
      !emailData.assigneeEmail ||
      !emailData.taskTitle ||
      !emailData.recipients ||
      emailData.recipients.length === 0
    ) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Validate status change specific fields
    if (
      emailData.eventType === "STATUS_CHANGED" &&
      (!emailData.oldStatus || !emailData.newStatus)
    ) {
      return new Response(
        JSON.stringify({ error: "Missing status change fields (oldStatus, newStatus)" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    // Get SMTP credentials from environment variables (Supabase Secrets)
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");

    if (!smtpUser || !smtpPass) {
      console.error("[send-task-email] SMTP credentials not configured");
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
      secure: false, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    // Create Supabase client for logging
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[send-task-email] Supabase credentials not configured");
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

    // --- 발송 스킵 조건 (케이스 1: ASSIGNED→IN_PROGRESS, 케이스 5: REJECTED→IN_PROGRESS) ---
    const shouldSkipEmail =
      emailData.eventType === "STATUS_CHANGED" &&
      emailData.oldStatus &&
      emailData.newStatus &&
      ((emailData.oldStatus === "ASSIGNED" && emailData.newStatus === "IN_PROGRESS") ||
        (emailData.oldStatus === "REJECTED" && emailData.newStatus === "IN_PROGRESS"));

    // --- 수신자별 이메일 발송 및 email_logs 기록 ---
    const recipientList: Array<{ role: "assigner" | "assignee"; email: string; name: string }> = [];

    if (emailData.recipients.includes("assigner")) {
      recipientList.push({
        role: "assigner",
        email: emailData.assignerEmail,
        name: emailData.assignerName || "할당자",
      });
    }

    if (emailData.recipients.includes("assignee")) {
      recipientList.push({
        role: "assignee",
        email: emailData.assigneeEmail,
        name: emailData.assigneeName || "담당자",
      });
    }

    // Send emails to each recipient with role-specific templates
    const results = await Promise.all(
      recipientList.map(async (recipient) => {
        // Generate role-specific email template
        const { subject, html } = getEmailTemplate(emailData, recipient.role);

        let result: { success: boolean; error?: string };
        let logStatus: string;
        let sentAt: string | null = null;

        if (shouldSkipEmail) {
          // 이메일 전송은 스킵하지만 로그는 기록
          result = { success: true }; // 로그 목적으로 성공으로 처리
          logStatus = "skipped";
        } else {
          // 정상적으로 이메일 전송
          result = await sendEmail(transporter, recipient.email, subject, html);
          logStatus = result.success ? "sent" : "failed";
          sentAt = result.success ? new Date().toISOString() : null;
        }

        // Log email attempt (항상 로그 기록)
        // Note: Supabase JS client should automatically convert UUID strings to UUID type
        // But if there's a type mismatch error, we need to ensure the string is a valid UUID format
        const { error: logError } = await supabase.from("email_logs").insert({
          task_id: emailData.taskId, // This should be a valid UUID string, Supabase will convert it
          recipient_email: recipient.email,
          recipient_name: recipient.name,
          subject,
          status: logStatus,
          error_message: result.error || null,
          sent_at: sentAt,
        });

        if (logError) {
          console.error(`[send-task-email] Failed to log email for ${recipient.email}:`, logError);
        }

        return { ...result, recipient: recipient.email, role: recipient.role };
      }),
    );

    // Check if all emails were sent successfully
    const allSuccess = results.every((r) => r.success);
    const failedRecipients = results.filter((r) => !r.success).map((r) => r.recipient);

    return new Response(
      JSON.stringify({
        success: allSuccess,
        message: allSuccess
          ? "Emails sent successfully"
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
    console.error("[send-task-email] Error sending email:", error);
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
