// hooks/useLanguageSync.ts
import { useEffect, useState } from "react";
import i18n from "@/i18n";

export function useI18nRehydrate() {
  const [language, setLanguage] = useState<string>(() => {
    if (typeof window === "undefined") return "ko";
    return i18n.language;
  });

  useEffect(() => {
    const handleLanguageChange = (lng: string) => {
      setLanguage(lng);
    };

    // 같은 탭에서 언어 변경
    i18n.on("languageChanged", handleLanguageChange);

    // 다른 탭에서 언어 변경 (localStorage 동기화)
    const onStorage = (e: StorageEvent) => {
      if (e.key === "i18nextLng" && e.newValue) {
        i18n.changeLanguage(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      i18n.off("languageChanged", handleLanguageChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return language;
}
