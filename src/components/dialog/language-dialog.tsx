import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ReactNode } from "react";
import { Button } from "../ui/button";
import { DialogClose } from "@radix-ui/react-dialog";
import { LanguageSelector } from "../select/language-selector";
import { useTranslation } from "react-i18next";
import { useState } from "react";

export default function LanguageDialog({ children }: { children: ReactNode }) {
  const { i18n, t } = useTranslation();
  const [selectedLanguage, setSelectedLanguage] = useState(i18n.language);

  return (
    <Dialog
      onOpenChange={(open) => {
        if (open) setSelectedLanguage(i18n.language);
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>

      <div>
        <DialogContent showCloseButton={true}>
          <DialogHeader>
            <DialogTitle>{t("dialog.language.title")}</DialogTitle>
            <DialogDescription>{t("dialog.language.description")}</DialogDescription>
          </DialogHeader>

          <LanguageSelector value={selectedLanguage} onChange={setSelectedLanguage} />

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" type="button">
                {t("common.cancel")}
              </Button>
            </DialogClose>
            <DialogClose asChild>
              <Button onClick={() => i18n.changeLanguage(selectedLanguage)}>
                {t("common.save")}
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </div>
    </Dialog>
  );
}
