import "./sentry.client";
import { createRoot } from "react-dom/client";
import "./index.css";
import { BrowserRouter } from "react-router";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import i18n from "./i18n";

import App from "./App.tsx";
import { Toaster } from "sonner";
import { DefaultSeo } from "./components/common/default-seo.tsx";
import { HeadProvider } from "react-head";
import { I18nextProvider } from "react-i18next";
import { useI18nRehydrate } from "./hooks/use-i18n-hydrate.ts";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1, // 실패 시 1번만 재시도
      refetchOnWindowFocus: true, // 윈도우 포커스 시 자동 refetch 활성화 (다른 사용자의 변경사항 빠르게 반영)
      refetchOnMount: true, // 컴포넌트 마운트 시 refetch
      refetchOnReconnect: true, // 네트워크 재연결 시 refetch
      staleTime: 0, // 데이터가 즉시 stale 상태가 됨
      gcTime: 5 * 60 * 1000, // 5분 후 가비지 컬렉션 (이전 cacheTime)
    },
    mutations: {
      retry: 1, // mutation 실패 시 1번만 재시도
    },
  },
});

function Root() {
  const language = useI18nRehydrate();

  return (
    <I18nextProvider i18n={i18n} key={language}>
      <HeadProvider>
        <BrowserRouter>
          <QueryClientProvider client={queryClient}>
            <ReactQueryDevtools />
            <DefaultSeo />
            <App />
            <Toaster />
          </QueryClientProvider>
        </BrowserRouter>
      </HeadProvider>
    </I18nextProvider>
  );
}

createRoot(document.getElementById("root")!).render(<Root />);
