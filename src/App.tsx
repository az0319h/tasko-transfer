import { useTranslation } from "react-i18next";
import RootRoute from "./root-router";
import DefaultSpinner from "./components/common/default-spinner";
import SessionProvider from "./provider/session-provider";
import { useEffect } from "react";
import { toast } from "sonner";

export default function App() {
  const { ready } = useTranslation();
  
  // URL 해시 메시지 처리 (이메일 확인 등)
  useEffect(() => {
    if (!ready) return;

    const handleHashMessage = () => {
      const hash = window.location.hash;
      if (!hash) return;

      // Supabase 인증 메시지 처리
      const messageMatch = hash.match(/message=([^&]+)/);
      if (messageMatch) {
        const message = decodeURIComponent(messageMatch[1].replace(/\+/g, " "));
        
        // 이메일 변경 관련 메시지 처리
        if (message.includes("Confirmation link accepted") && message.includes("other email")) {
          toast.info(
            "첫 번째 이메일 확인이 완료되었습니다.\n\n이메일 변경을 완료하려면 다른 이메일로 발송된 확인 링크도 클릭해야 합니다.\n\n기존 이메일과 새 이메일 모두에서 확인 링크를 클릭해주세요.",
            {
              position: "bottom-right",
              duration: 15000, // 15초간 표시
            }
          );
        } else if (message.includes("Email change confirmed")) {
          toast.success("이메일 변경이 완료되었습니다.", {
            position: "bottom-right",
          });
        } else if (message.includes("Confirmation link accepted")) {
          toast.success("이메일 확인이 완료되었습니다.", {
            position: "bottom-right",
          });
        }

        // 해시 제거 (한 번만 표시)
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    };

    handleHashMessage();
  }, [ready]);

  if (!ready) return <DefaultSpinner />;

  return (
    <SessionProvider>
      <RootRoute />
    </SessionProvider>
  );
}
