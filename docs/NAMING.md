# Tasko 네이밍 규칙

프로젝트 구조 및 파일/컴포넌트 네이밍 일관성 유지를 위한 규칙입니다.

---

## 페이지 (pages/)

| 패턴 | 예시 |
|------|------|
| `{기능}-page.tsx` | `sign-in-page.tsx`, `profile-page.tsx` |
| `{도메인}-{기능}-page.tsx` | `task-detail-page.tsx`, `task-list-detail-page.tsx` |
| Admin 목록: `admin-{리소스}s-page.tsx` (복수형) | `admin-users-page.tsx`, `admin-announcements-page.tsx` |
| Admin 상세/폼: `admin-{리소스}-{액션}-page.tsx` | (필요 시) |

---

## 컴포넌트

| 유형 | 패턴 | 예시 |
|------|------|------|
| 다이얼로그/모달 | `*-dialog.tsx` | `announcement-dialog.tsx`, `task-form-dialog.tsx` |
| 레이아웃 | `*-layout.tsx` | `global-layout.tsx`, `member-only-layout.tsx` |
| 폼 | `*-form.tsx` | `announcement-form.tsx`, `sign-in-form.tsx` |

> **참고**: `modal` 대신 `dialog` 사용 (Radix/shadcn UI 컴포넌트명과 일치)

---

## 훅 (hooks/)

| 패턴 | 예시 |
|------|------|
| `use-{도메인}-{기능}.ts` | `use-tasks.ts`, `use-realtime-messages.ts` |
| kebab-case | 모든 훅 파일명 |

---

## API (api/)

| 패턴 | 예시 |
|------|------|
| 도메인 단수 | `task.ts`, `message.ts`, `announcement.ts` |
| 복합 도메인 | `task-list.ts` |

---

## 타입 (types/)

| 위치 | 용도 |
|------|------|
| `types/common.ts` | 공통 타입 (Theme, UseMutationCallback) |
| `types/domain/{도메인}.ts` | 도메인별 타입 |

---

## 공통 규칙

- **파일명**: kebab-case (`task-detail-page.tsx`)
- **폴더명**: kebab-case 또는 단수 도메인 (`task/`, `agent/`)
- **변수/함수**: 다이얼로그 관련 시 `dialog` 용어 사용 (`isDialogOpen`, `handleDialogClose`)
