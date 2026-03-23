import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ReactNode } from "react";
import { Button } from "../ui/button";
import { useState, useEffect } from "react";
import { ThemeSelector } from "../select/theme-selector";
import type { Theme } from "@/types/common";
import { getSavedThemeMode } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export default function ThemeDialog({ children }: { children: ReactNode }) {
  const { t } = useTranslation();

  const [selectedTheme, setSelectedTheme] = useState<Theme>("system");

  // 선택된 테마를 html에 적용
  const applyTheme = (theme: Theme) => {
    const htmlTag = document.documentElement;
    htmlTag.classList.remove("light", "dark");

    if (theme === "system") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      htmlTag.classList.add(isDark ? "dark" : "light");
    } else {
      htmlTag.classList.add(theme);
    }
  };

  // 시스템 테마 변경 감지 (system 모드일 때 반응하도록)
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (selectedTheme === "system") applyTheme("system");
    };
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [selectedTheme]);

  // 저장 버튼 클릭 시 적용
  const handleSave = () => {
    applyTheme(selectedTheme);
    localStorage.setItem("theme", selectedTheme);

    // 같은 탭에서 즉시 리렌더 트리거
    window.dispatchEvent(new Event("theme-change"));
  };

  // 새로고침 시 테마 복원
  useEffect(() => {
    const savedTheme = (localStorage.getItem("theme") as Theme) || "system";
    setSelectedTheme(savedTheme);
    applyTheme(savedTheme);
  }, []);

  return (
    <Dialog
      onOpenChange={(open) => {
        if (open) setSelectedTheme(getSavedThemeMode());
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>{t("dialog.theme.title")}</DialogTitle>
          <DialogDescription>{t("dialog.theme.description")}</DialogDescription>
        </DialogHeader>

        <ThemeSelector value={selectedTheme} onChange={setSelectedTheme} />

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("common.cancel")}</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button onClick={handleSave}>{t("common.save")}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
