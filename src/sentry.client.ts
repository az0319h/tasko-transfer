import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  replaysSessionSampleRate: 0, // 일반 세션 녹화 안 함
  replaysOnErrorSampleRate: 1.0, // 에러 발생 시 100% 녹화
  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
});
