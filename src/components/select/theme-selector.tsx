import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Theme } from "@/types/common";
import { Sun, Moon, Laptop } from "lucide-react";
import { useTranslation } from "react-i18next";

type ThemeSelectorProps = {
  value: Theme;
  onChange: (theme: Theme) => void;
};

export function ThemeSelector({ value, onChange }: ThemeSelectorProps) {
  const { t } = useTranslation();

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="테마 선택" />
      </SelectTrigger>

      <SelectContent>
        <SelectGroup>
          <SelectLabel>{t("select.label.theme")}</SelectLabel>

          <SelectItem value="light">
            <div className="flex items-center gap-2">
              <Sun className={`text-foreground size-4`} />
              <span>라이트 ∙ Light</span>
            </div>
          </SelectItem>

          <SelectItem value="dark">
            <div className="flex items-center gap-2">
              <Moon className={`text-foreground size-4`} />
              <span>다크 ∙ Dark</span>
            </div>
          </SelectItem>

          <SelectItem value="system">
            <div className="flex items-center gap-2">
              <Laptop className={`text-foreground size-4`} />
              <span>시스템 ∙ System</span>
            </div>
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
