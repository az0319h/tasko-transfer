# Tasko

Tasko는 회사 내부에서 업무 할당, 진행, 승인 및 커뮤니케이션을 한 곳에서 관리하기 위한 협업 플랫폼입니다.

---

## 목차

- [기술 스택](#기술-스택)
- [설치 및 실행](#설치-및-실행)
- [주요 기능](#주요-기능)
- [프로젝트 구조](#프로젝트-구조)
- [기여 방법](#기여-방법)
- [관련 문서](#관련-문서)

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프레임워크 | React 19, Vite 6 |
| 스타일링 | Tailwind CSS 4, shadcn/ui (Radix UI) |
| 상태 관리 | TanStack Query, Zustand |
| 백엔드 | Supabase (Auth, Realtime, Edge Functions) |
| 폼 | React Hook Form, Zod |
| 기타 | React Router 7, i18next, Sentry |

---

## 설치 및 실행

### 사전 요구사항

- Node.js 18.x 이상
- npm 또는 pnpm

### 설치

```bash
npm install
```

### 환경 변수 설정

프로젝트 루트에 `.env` 파일을 생성하고 다음 변수를 설정합니다:

```env
VITE_FRONTEND_URL=http://localhost:5173 | 배포 사이트 주소
VITE_SUPABASE_URL=<Supabase 프로젝트 URL>
VITE_SUPABASE_ANON_KEY=<Supabase anon key>
VITE_SENTRY_DSN=<Sentry DSN (선택)>
VITE_KAKAO_APP_KEY=<Kakao JavaScript 키>
```

### 실행

```bash
# 개발 서버
npm run dev

# 빌드
npm run build

# 빌드 결과물 미리보기
npm start
```

개발 서버는 기본적으로 `http://localhost:5173`에서 실행됩니다.

---

## 주요 기능

- **업무(Task) 관리**: 업무 생성, 할당, 상태 변경(할당됨 → 진행 중 → 확인 대기 → 승인/거부)
- **대시보드**: 담당 업무, 전체 업무, 참조 업무별 조회 및 필터링
- **실시간 채팅**: Task별 채팅, 읽지 않은 메시지 수 표시
- **일정 관리**: 달력 기반 일정 조회, 담당자 일정 자동 배치
- **알림**: 마감일 임박/초과 알림, 실시간 알림
- **공지사항**: 관리자 공지 작성 및 조회
- **에이전트**: AI 에이전트 연동 (선택)

---

## 프로젝트 구조

```text
src/
├── api/          # API 호출 모듈
├── components/   # UI 컴포넌트
├── hooks/        # 커스텀 훅
├── pages/        # 페이지 컴포넌트
├── types/        # TypeScript 타입
├── utils/        # 유틸리티 함수
├── App.tsx
└── root-router.tsx
```

네이밍 규칙은 [docs/NAMING.md](docs/NAMING.md)를 참고하세요.

---

## 테스트

```bash
npm run build   # 타입 체크 및 빌드
npm run lint    # ESLint 실행
```

---

## 기여 방법

1. 이슈를 생성하거나 기존 이슈를 확인합니다.
2. 새로운 브랜치를 생성하고 작업합니다.
3. Pull Request를 생성합니다. ([PR 템플릿](.github/pull_request_template.md) 참고)

---

## 관련 문서

- [네이밍 규칙](docs/NAMING.md) - 파일/컴포넌트 네이밍 가이드
- [Supabase Edge Functions](supabase/functions/README.md) - 백엔드 함수 설명
