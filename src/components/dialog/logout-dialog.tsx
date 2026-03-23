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
import { useState } from "react";
import { useSignOut } from "@/hooks/mutations/use-sign-out";
import { useSetSession } from "@/store/session";
import { toast } from "sonner";
import { generateErrorMessage } from "@/lib/error";

export default function LogoutDialog({
  children,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const setSession = useSetSession();
  
  // controlled 또는 uncontrolled 모드 지원
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;

  const { mutate: signOut, isPending } = useSignOut({
    onSuccess: () => {
      setSession(null);
      setOpen(false);
      toast.success("로그아웃되었습니다.", {
        position: "bottom-right",
      });
    },
    onError: (error) => {
      const message = generateErrorMessage(error);
      toast.error(message, {
        position: "bottom-right",
      });
    },
  });

  function handleLogout() {
    signOut();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>로그아웃</DialogTitle>
          <DialogDescription>정말 로그아웃하시겠습니까?</DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isPending}>
              취소
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" onClick={handleLogout} disabled={isPending}>
            {isPending ? "로그아웃 중..." : "로그아웃"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
