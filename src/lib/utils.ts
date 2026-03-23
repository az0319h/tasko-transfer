import type { Theme } from "@/types/common";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * localStorage의 "theme" 값을 읽어서
 * - "dark"면 "dark"
 * - "system"이면 "system"
 * - 그 외("undefined" | null 등)는 "system"
 */
export function getSavedThemeMode(): Theme {
  if (typeof window === "undefined") return "system";

  const saved = localStorage.getItem("theme");
  if (saved === "dark" || saved === "light" || saved === "system") return saved;
  return "system";
}

/**
 * "현재 화면에 적용될 실제 테마"를 반환
 * - 반환값은 무조건 "light" | "dark"
 * - localStorage가 "system"(또는 null)이면 OS 설정을 따라감
 */
export function getResolvedThemeMode(): "light" | "dark" {
  if (typeof window === "undefined") return "light";

  const saved = (localStorage.getItem("theme") as Theme | null) ?? "system";

  if (saved === "dark") return "dark";
  if (saved === "light") return "light";

  // saved === "system"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
