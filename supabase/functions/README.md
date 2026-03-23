# Edge Functions 개요

Tasko 프로젝트의 Supabase Edge Functions 목록입니다. 각 함수 상단에 상세 주석이 있습니다.

| 함수명 | 역할 | 호출 방식 | 필수 환경 변수 |
|--------|------|-----------|----------------|
| **get-link-preview** | URL 메타데이터 추출 (채팅 링크 미리보기) | HTTP POST | `SUPABASE_URL`, `SUPABASE_ANON_KEY` |
| **invite-user** | 관리자 사용자 초대 | HTTP POST | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_FRONTEND_URL` 또는 `SITE_URL` |
| **check-due-date-exceeded** | 일정 시작일 > 마감일 여부 확인 | HTTP POST | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| **check-due-date-approaching** | 마감 0~2일 남은 Task 알림 생성 | pg_cron 등 | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| **check-due-date-exceeded-notification** | 마감일 초과 미승인 Task 알림 생성 | pg_cron 등 | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| **send-task-email** | Task 생성/상태 변경 시 이메일 발송 | DB 트리거 또는 HTTP | `SMTP_USER`, `SMTP_PASS`, `FRONTEND_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| **send-task-reference-email** | 참조자 추가/상태 변경 시 참조자 이메일 발송 | DB 트리거 또는 HTTP | `SMTP_USER`, `SMTP_PASS`, `FRONTEND_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| **send-confirm-email** | 컨펌 이메일 발송 (관리자+담당자, DOCX→PDF 변환) | HTTP POST | `SMTP_USER`, `SMTP_PASS`, `CONVERTAPI_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |

## 환경 변수 설정

Supabase Dashboard → Project Settings → Edge Functions → Secrets 에서 설정합니다.

## 로컬 실행

```bash
supabase functions serve <함수명>
```
