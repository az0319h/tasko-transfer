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
import {
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from "@/schemas/auth/reset-password-schema";
import { useResetPassword } from "@/hooks";
import { toast } from "sonner";
import { generateErrorMessage } from "@/lib/error";
import { Link } from "react-router";
import { getResolvedThemeMode } from "@/lib/utils";
import logo_dark from "@/assets/logo_dark.png";
import logo_light from "@/assets/logo_light.png";

export function ForgotPasswordForm() {
  const mode = getResolvedThemeMode();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const {
    mutate: resetPassword,
    isPending,
    isSuccess,
  } = useResetPassword({
    onSuccess: () => {
      toast.success("비밀번호 재설정 이메일이 전송되었습니다.", {
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

  function onSubmit(data: ForgotPasswordFormValues) {
    resetPassword(data.email);
  }

  if (isSuccess) {
    return (
      <Card className="flex flex-col gap-4 border-0 !bg-transparent !shadow-none outline-0 lg:gap-6">
        <CardHeader className="px-0">
          <CardTitle>이메일이 전송되었습니다</CardTitle>
          <CardDescription>
            입력하신 이메일 주소로 비밀번호 재설정 링크를 보냈습니다. 이메일을 확인해주세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="!px-0">
          <Button asChild variant="outline" className="w-full">
            <Link to="/sign-in">로그인 페이지로 돌아가기</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 !bg-transparent !shadow-none outline-0">
      <CardHeader>
        <div className="flex flex-col items-center gap-4">
          <img
            src={mode === "dark" ? logo_light : logo_dark}
            alt="logo"
            className="size-10 lg:hidden"
          />
          <CardTitle className="text-20-medium text-center">Tasko 계정으로 비밀번호 찾기</CardTitle>
          <CardDescription className="hidden text-center lg:block">
            이메일을 입력하시면 비밀번호 재설정 링크를 보내드립니다.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldSet disabled={isPending}>
            <FieldGroup>
              {/* Email */}
              <Field data-invalid={!!errors.email}>
                <FieldLabel htmlFor="email">이메일</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@basspat.co"
                  {...register("email")}
                />
                {errors.email ? (
                  <FieldError errors={[errors.email]} />
                ) : (
                  <FieldDescription>가입하신 이메일 주소를 입력해주세요.</FieldDescription>
                )}
              </Field>

              <Field>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "전송 중..." : "재설정 링크 보내기"}
                </Button>
              </Field>
            </FieldGroup>
          </FieldSet>
        </form>

        <div className="mt-4 text-center text-sm">
          <Link to="/sign-in" className="text-primary hover:underline">
            로그인 페이지로 돌아가기
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
