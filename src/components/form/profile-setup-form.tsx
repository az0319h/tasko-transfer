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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  profileSetupSchema,
  type ProfileSetupFormValues,
} from "@/schemas/profile/profile-setup-schema";
import { useSetupProfileWithPassword } from "@/hooks/mutations/use-profile-setup";
import { useCurrentProfile } from "@/hooks";
import { toast } from "sonner";
import { generateErrorMessage } from "@/lib/error";
import { useNavigate } from "react-router";
import { cn, getResolvedThemeMode } from "@/lib/utils";
import logo_dark from "@/assets/logo_dark.png";
import logo_light from "@/assets/logo_light.png";
import { useEffect, useState } from "react";
import supabase from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";

export function ProfileSetupForm() {
  const mode = getResolvedThemeMode();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: currentProfile } = useCurrentProfile();
  const [userEmail, setUserEmail] = useState<string>("");

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<ProfileSetupFormValues>({
    resolver: zodResolver(profileSetupSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
      full_name: "",
      position: "",
      phone: "",
    },
  });

  const positionValue = watch("position");

  // 현재 사용자 정보 가져오기
  useEffect(() => {
    const getUserInfo = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email ?? "");
        // 프로필 정보가 있으면 폼에 채우기
        if (currentProfile) {
          reset({
            password: "",
            confirmPassword: "",
            full_name: currentProfile.full_name ?? "",
            position: currentProfile.position ?? "",
            phone: currentProfile.phone ?? "",
          });
        }
      }
    };
    getUserInfo();
  }, [currentProfile, reset]);

  const { mutate: setupProfile, isPending } = useSetupProfileWithPassword({
    onSuccess: async (data) => {
      toast.success("비밀번호와 프로필 설정이 완료되었습니다.", {
        position: "bottom-right",
      });

      // 쿼리 캐시를 직접 업데이트하여 즉시 반영
      queryClient.setQueryData(["profile", "current"], data);

      // 약간의 지연을 주어 데이터베이스 업데이트가 완료되도록 보장
      await new Promise((resolve) => setTimeout(resolve, 300));

      // 세션을 새로고침해서 라우팅 가드를 통과할 수 있도록 보장
      await supabase.auth.getSession();

      // 쿼리를 다시 가져와서 최신 데이터로 업데이트
      await queryClient.refetchQueries({ queryKey: ["profile", "current"] });

      // 네비게이션
      navigate("/", { replace: true });
    },
    onError: (error) => {
      const message = generateErrorMessage(error);
      toast.error(message, {
        position: "bottom-right",
      });
    },
  });

  function onSubmit(data: ProfileSetupFormValues) {
    setupProfile({
      password: data.password,
      full_name: data.full_name,
      position: data.position,
      phone: data.phone,
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
          <CardTitle className="text-20-medium text-center">프로필 설정</CardTitle>
          <CardDescription className="text-center">
            비밀번호와 프로필 정보를 설정해주세요.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldSet disabled={isPending}>
            <FieldGroup>
              {/* Email (읽기 전용) */}
              <Field>
                <FieldLabel htmlFor="email">이메일</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  value={userEmail || currentProfile?.email || ""}
                  disabled
                  className="bg-muted"
                />
                <FieldDescription>이메일은 변경할 수 없습니다.</FieldDescription>
              </Field>

              {/* Password */}
              <Field data-invalid={!!errors.password}>
                <FieldLabel htmlFor="password">비밀번호</FieldLabel>
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

              {/* Full Name */}
              <Field data-invalid={!!errors.full_name}>
                <FieldLabel htmlFor="full_name">이름</FieldLabel>
                <Input id="full_name" type="text" placeholder="홍길동" {...register("full_name")} />
                {errors.full_name ? (
                  <FieldError errors={[errors.full_name]} />
                ) : (
                  <FieldDescription>이름을 입력해주세요.</FieldDescription>
                )}
              </Field>

              {/* Position */}
              <Field data-invalid={!!errors.position}>
                <FieldLabel htmlFor="position">직책</FieldLabel>
                <Select
                  value={positionValue}
                  onValueChange={(value) => setValue("position", value, { shouldValidate: true })}
                >
                  <SelectTrigger id="position" className="w-full">
                    <SelectValue placeholder="직책을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>일반 직급</SelectLabel>
                      <SelectItem value="인턴">인턴</SelectItem>
                      <SelectItem value="사원">사원</SelectItem>
                      <SelectItem value="대리">대리</SelectItem>
                      <SelectItem value="과장">과장</SelectItem>
                      <SelectItem value="차장">차장</SelectItem>
                      <SelectItem value="부장">부장</SelectItem>
                      <SelectItem value="이사">이사</SelectItem>
                      <SelectItem value="상무">상무</SelectItem>
                      <SelectItem value="전무">전무</SelectItem>
                      <SelectItem value="부사장">부사장</SelectItem>
                      <SelectItem value="사장">사장</SelectItem>
                      <SelectItem value="대표이사">대표이사</SelectItem>
                      <SelectItem value="임원">임원</SelectItem>
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel>법률 사무소 특화</SelectLabel>
                      <SelectItem value="변호사">변호사</SelectItem>
                      <SelectItem value="변리사">변리사</SelectItem>
                      <SelectItem value="연구원">연구원</SelectItem>
                      <SelectItem value="책임연구원">책임연구원</SelectItem>
                      <SelectItem value="수석연구원">수석연구원</SelectItem>
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel>전문직</SelectLabel>
                      <SelectItem value="디자이너">디자이너</SelectItem>
                      <SelectItem value="개발자">개발자</SelectItem>
                      <SelectItem value="기획자">기획자</SelectItem>
                      <SelectItem value="마케터">마케터</SelectItem>
                      <SelectItem value="운영자">운영자</SelectItem>
                      <SelectItem value="관리자">관리자</SelectItem>
                      <SelectItem value="회계사">회계사</SelectItem>
                      <SelectItem value="세무사">세무사</SelectItem>
                      <SelectItem value="노무사">노무사</SelectItem>
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel>기타</SelectLabel>
                      <SelectItem value="기타">기타</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {errors.position ? (
                  <FieldError errors={[errors.position]} />
                ) : (
                  <FieldDescription>직책을 선택해주세요.</FieldDescription>
                )}
              </Field>

              {/* Phone */}
              <Field data-invalid={!!errors.phone}>
                <FieldLabel htmlFor="phone">전화번호</FieldLabel>
                <Input id="phone" type="tel" placeholder="010-1234-5678" {...register("phone")} />
                {errors.phone ? (
                  <FieldError errors={[errors.phone]} />
                ) : (
                  <FieldDescription>전화번호를 입력해주세요.</FieldDescription>
                )}
              </Field>

              <Field>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "설정 중..." : "설정 완료"}
                </Button>
              </Field>
            </FieldGroup>
          </FieldSet>
        </form>
      </CardContent>
    </Card>
  );
}
