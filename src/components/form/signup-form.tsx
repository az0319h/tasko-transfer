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
import { signupSchema, type SignupFormValues } from "@/schemas/auth/signup-schema";
import { useSignUp } from "@/hooks";
import { useCreateProfileAuto } from "@/hooks/mutations/use-profile-auto";
import { toast } from "sonner";
import { generateErrorMessage } from "@/lib/error";
import { useNavigate, useSearchParams } from "react-router";
import { cn, getResolvedThemeMode } from "@/lib/utils";
import logo_dark from "@/assets/logo_dark.png";
import logo_light from "@/assets/logo_light.png";

export function SignupForm() {
  const mode = getResolvedThemeMode();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: email ?? "",
      password: "",
      confirmPassword: "",
    },
  });

  const { mutate: createProfileAuto } = useCreateProfileAuto({
    onError: (error) => {
      console.error("프로필 자동 생성 실패:", error);
      // 프로필 생성 실패해도 계정은 생성되었으므로 로그인 페이지로 이동
    },
  });

  const { mutate: signUp, isPending } = useSignUp({
    onSuccess: async (data) => {
      // 회원가입 성공 시 프로필 자동 생성 (profile_completed = false)
      // 세션이 있으면 프로필 생성 시도
      if (data.session) {
        createProfileAuto();
      }

      toast.success("회원가입이 완료되었습니다. 로그인 후 프로필을 설정해주세요.", {
        position: "bottom-right",
      });
      navigate("/sign-in", { replace: true });
    },
    onError: (error) => {
      const message = generateErrorMessage(error);
      toast.error(message, {
        position: "bottom-right",
      });
    },
  });

  function onSubmit(data: SignupFormValues) {
    signUp({
      email: data.email,
      password: data.password,
    });
  }

  return (
    <Card className={cn("border-0 outline-0")}>
      <CardHeader>
        <div className="flex flex-col items-center gap-4">
          <img
            src={mode === "light" ? logo_dark : logo_light}
            alt="logo_character"
            className="size-10"
          />
          <CardTitle className="text-20-medium text-center">회원가입</CardTitle>
          <CardDescription className="text-center">
            초대를 받으신 이메일 주소로 계정을 생성하세요.
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
                  disabled={!!email}
                />
                {errors.email ? (
                  <FieldError errors={[errors.email]} />
                ) : (
                  <FieldDescription>이메일 주소를 입력해주세요.</FieldDescription>
                )}
              </Field>

              {/* Password */}
              <Field data-invalid={!!errors.password}>
                <FieldLabel htmlFor="password">비밀번호</FieldLabel>
                <Input id="password" type="password" {...register("password")} />
                {errors.password ? (
                  <FieldError errors={[errors.password]} />
                ) : (
                  <FieldDescription>최소 8자 이상, 문자와 숫자를 포함해야 합니다.</FieldDescription>
                )}
              </Field>

              {/* Confirm Password */}
              <Field data-invalid={!!errors.confirmPassword}>
                <FieldLabel htmlFor="confirmPassword">비밀번호 확인</FieldLabel>
                <Input id="confirmPassword" type="password" {...register("confirmPassword")} />
                {errors.confirmPassword ? (
                  <FieldError errors={[errors.confirmPassword]} />
                ) : (
                  <FieldDescription>비밀번호를 다시 입력해주세요.</FieldDescription>
                )}
              </Field>

              <Field>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "가입 중..." : "회원가입"}
                </Button>
              </Field>
            </FieldGroup>
          </FieldSet>
        </form>
      </CardContent>
    </Card>
  );
}

