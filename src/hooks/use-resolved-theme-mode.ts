import { useEffect, useState } from "react";
import { getResolvedThemeMode } from "@/lib/utils";

function applyThemeToHtml(theme: "light" | "dark") {
  const html = document.documentElement;
  html.classList.remove("light", "dark");
  html.classList.add(theme);
}

export function useResolvedThemeMode() {
  const [mode, setMode] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    const resolved = getResolvedThemeMode();
    applyThemeToHtml(resolved); // 최초 적용
    return resolved;
  });

  useEffect(() => {
    const update = () => {
      const resolved = getResolvedThemeMode();
      applyThemeToHtml(resolved); // 레이아웃 전체 변경
      setMode(resolved); // 로고 등 React UI 변경
    };

    // 같은 탭에서 theme 변경
    window.addEventListener("theme-change", update);

    // system 모드일 때 시스템 테마 변경
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onMqChange = () => {
      const saved = localStorage.getItem("theme");
      if (!saved || saved === "system") update();
    };
    mq.addEventListener("change", onMqChange);

    // 다른 탭
    const onStorage = (e: StorageEvent) => {
      if (e.key === "theme") update();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("theme-change", update);
      mq.removeEventListener("change", onMqChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return mode;
}
