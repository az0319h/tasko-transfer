import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "react-i18next";

type LanguageSelectorProps = {
  value: string;
  onChange: (lang: string) => void;
};

export function LanguageSelector({ value, onChange }: LanguageSelectorProps) {
  const { t } = useTranslation();

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={value} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>{t("select.label.language")}</SelectLabel>
          <SelectItem value="ko">한국어 ∙ Korean</SelectItem>
          <SelectItem value="en">English ∙ English</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
