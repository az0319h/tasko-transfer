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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldSet } from "../ui/field";
import { Input } from "../ui/input";
import { changeEmailSchema, type ChangeEmailFormValues } from "@/schemas/auth/change-email-schema";
import { useChangeEmail } from "@/hooks/mutations/use-email";
import { toast } from "sonner";
import { generateErrorMessage } from "@/lib/error";
import { useState } from "react";
import { useCurrentProfile } from "@/hooks";

export default function ChangeEmailDialog({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { data: profile } = useCurrentProfile();
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ChangeEmailFormValues>({
    resolver: zodResolver(changeEmailSchema),
    defaultValues: {
      currentPassword: "",
      newEmail: "",
      confirmEmail: "",
    },
  });

  const { mutate: changeEmail, isPending } = useChangeEmail({
    onSuccess: (_, variables) => {
      toast.success(
        `이메일 변경 요청이 완료되었습니다.\n\n현재 이메일(${profile?.email})과 새 이메일(${variables.newEmail})로 각각 확인 링크가 발송되었습니다.\n\n두 이메일의 확인 링크를 모두 클릭해야 이메일 변경이 완료됩니다.`,
        {
          position: "bottom-right",
          duration: 10000, // 10초간 표시
        },
      );
      reset();
      setOpen(false);
    },
    onError: (error) => {
      const message = generateErrorMessage(error);
      toast.error(message, {
        position: "bottom-right",
      });
    },
  });

  function onSubmit(data: ChangeEmailFormValues) {
    changeEmail({
      currentPassword: data.currentPassword,
      newEmail: data.newEmail,
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>이메일 변경</DialogTitle>
          <DialogDescription>
            기존 비밀번호를 입력하고 새로운 이메일 주소를 설정해주세요.
            <br />
            <br />
            <strong className="text-foreground">중요:</strong> 이메일 변경을 완료하려면{" "}
            <strong className="text-foreground">두 이메일 모두</strong>에서 확인 링크를 클릭해야
            합니다.
            <br />
            <br />• 현재 이메일({profile?.email})로 확인 링크가 발송됩니다.
            <br />
            • 새 이메일로도 확인 링크가 발송됩니다.
            <br />
            <br />두 이메일의 확인 링크를 모두 클릭해야 이메일 변경이 완료됩니다.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldSet disabled={isPending}>
            <FieldGroup>
              {/* Current Email (Read-only) */}
              <Field>
                <FieldLabel>현재 이메일</FieldLabel>
                <Input type="email" value={profile?.email || ""} disabled className="bg-muted" />
                <FieldDescription>현재 사용 중인 이메일 주소입니다.</FieldDescription>
              </Field>

              {/* Current Password */}
              <Field data-invalid={!!errors.currentPassword}>
                <FieldLabel htmlFor="currentPassword">기존 비밀번호</FieldLabel>
                <Input
                  id="currentPassword"
                  type="password"
                  placeholder="기존 비밀번호를 입력하세요"
                  {...register("currentPassword")}
                />
                {errors.currentPassword ? (
                  <FieldError errors={[errors.currentPassword]} />
                ) : (
                  <FieldDescription>현재 사용 중인 비밀번호를 입력해주세요.</FieldDescription>
                )}
              </Field>

              {/* New Email */}
              <Field data-invalid={!!errors.newEmail}>
                <FieldLabel htmlFor="newEmail">새 이메일</FieldLabel>
                <Input
                  id="newEmail"
                  type="email"
                  placeholder="새 이메일 주소를 입력하세요"
                  {...register("newEmail")}
                />
                {errors.newEmail ? (
                  <FieldError errors={[errors.newEmail]} />
                ) : (
                  <FieldDescription>변경할 이메일 주소를 입력해주세요.</FieldDescription>
                )}
              </Field>

              {/* Confirm Email */}
              <Field data-invalid={!!errors.confirmEmail}>
                <FieldLabel htmlFor="confirmEmail">이메일 확인</FieldLabel>
                <Input
                  id="confirmEmail"
                  type="email"
                  placeholder="새 이메일 주소를 다시 입력하세요"
                  {...register("confirmEmail")}
                />
                {errors.confirmEmail ? (
                  <FieldError errors={[errors.confirmEmail]} />
                ) : (
                  <FieldDescription>이메일 주소를 다시 입력해주세요.</FieldDescription>
                )}
              </Field>
            </FieldGroup>
          </FieldSet>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                취소
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "변경 중..." : "변경"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
