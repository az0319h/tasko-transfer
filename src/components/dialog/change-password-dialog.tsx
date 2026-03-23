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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "../ui/field";
import { Input } from "../ui/input";
import {
  changePasswordSchema,
  type ChangePasswordFormValues,
} from "@/schemas/auth/change-password-schema";
import { useChangePassword } from "@/hooks/mutations/use-password";
import { toast } from "sonner";
import { generateErrorMessage } from "@/lib/error";
import { useState } from "react";

export default function ChangePasswordDialog({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const { mutate: changePassword, isPending } = useChangePassword({
    onSuccess: () => {
      toast.success("비밀번호가 변경되었습니다.", {
        position: "bottom-right",
      });
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

  function onSubmit(data: ChangePasswordFormValues) {
    changePassword({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>비밀번호 변경</DialogTitle>
          <DialogDescription>기존 비밀번호를 입력하고 새로운 비밀번호를 설정해주세요.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldSet disabled={isPending}>
            <FieldGroup>
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

              {/* New Password */}
              <Field data-invalid={!!errors.newPassword}>
                <FieldLabel htmlFor="newPassword">새 비밀번호</FieldLabel>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="새 비밀번호를 입력하세요"
                  {...register("newPassword")}
                />
                {errors.newPassword ? (
                  <FieldError errors={[errors.newPassword]} />
                ) : (
                  <FieldDescription>최소 8자 이상, 문자와 숫자를 포함해야 합니다.</FieldDescription>
                )}
              </Field>

              {/* Confirm Password */}
              <Field data-invalid={!!errors.confirmPassword}>
                <FieldLabel htmlFor="confirmPassword">비밀번호 확인</FieldLabel>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="새 비밀번호를 다시 입력하세요"
                  {...register("confirmPassword")}
                />
                {errors.confirmPassword ? (
                  <FieldError errors={[errors.confirmPassword]} />
                ) : (
                  <FieldDescription>비밀번호를 다시 입력해주세요.</FieldDescription>
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

