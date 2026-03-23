import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { resetPasswordSchema, type ResetPasswordFormValues } from "@/schemas/auth/reset-password-schema";
import { useUpdatePassword } from "@/hooks";
import { toast } from "sonner";
import { generateErrorMessage } from "@/lib/error";
import { useNavigate } from "react-router";

export function ResetPasswordForm() {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const { mutate: updatePassword, isPending, isSuccess } = useUpdatePassword({
    onSuccess: () => {
      toast.success("비밀번호가 변경되었습니다.", {
        position: "bottom-right",
      });
      setTimeout(() => {
        navigate("/sign-in", { replace: true });
      }, 1500);
    },
    onError: (error) => {
      const message = generateErrorMessage(error);
      toast.error(message, {
        position: "bottom-right",
      });
    },
  });

  function onSubmit(data: ResetPasswordFormValues) {
    updatePassword(data.password);
  }

  if (isSuccess) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>비밀번호가 변경되었습니다</CardTitle>
          <CardDescription>
            비밀번호가 성공적으로 변경되었습니다. 로그인 페이지로 이동합니다.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>새 비밀번호 설정</CardTitle>
        <CardDescription>새로운 비밀번호를 입력해주세요.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldSet disabled={isPending}>
            <FieldGroup>
              {/* Password */}
              <Field data-invalid={!!errors.password}>
                <FieldLabel htmlFor="password">새 비밀번호</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  placeholder="비밀번호를 입력하세요"
                  {...register("password")}
                />
                {errors.password ? (
                  <FieldError errors={[errors.password]} />
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
                  placeholder="비밀번호를 다시 입력하세요"
                  {...register("confirmPassword")}
                />
                {errors.confirmPassword ? (
                  <FieldError errors={[errors.confirmPassword]} />
                ) : (
                  <FieldDescription>비밀번호를 다시 입력해주세요.</FieldDescription>
                )}
              </Field>

              <Field>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "변경 중..." : "비밀번호 변경"}
                </Button>
              </Field>
            </FieldGroup>
          </FieldSet>
        </form>
      </CardContent>
    </Card>
  );
}


