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
import { profileUpdateSchema, type ProfileUpdateFormValues } from "@/schemas/profile/profile-schema";
import { useUpdateProfile, useCreateProfile, useCurrentProfile } from "@/hooks";
import { toast } from "sonner";
import { generateErrorMessage } from "@/lib/error";
import type { Database, Tables } from "@/database.type";
import { useNavigate } from "react-router";
import { useEffect } from "react";

type Profile = Tables<"profiles">;

interface ProfileFormProps {
  profile?: Profile | null;
  isSetup?: boolean;
}

export function ProfileForm({ profile, isSetup = false }: ProfileFormProps) {
  const navigate = useNavigate();
  const { data: currentProfile } = useCurrentProfile();
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ProfileUpdateFormValues>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      full_name: profile?.full_name ?? "",
      position: profile?.position ?? "",
      phone: profile?.phone ?? "",
    },
  });

  // 프로필 데이터가 변경되면 폼 값 업데이트
  useEffect(() => {
    if (currentProfile) {
      reset({
        full_name: currentProfile.full_name ?? "",
        position: currentProfile.position ?? "",
        phone: currentProfile.phone ?? "",
      });
    }
  }, [currentProfile, reset]);

  const { mutate: updateProfile, isPending: isUpdating } = useUpdateProfile({
    onSuccess: () => {
      toast.success("프로필이 수정되었습니다.", {
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

  const { mutate: createProfile, isPending: isCreating } = useCreateProfile({
    onSuccess: () => {
      toast.success("프로필이 생성되었습니다.", {
        position: "bottom-right",
      });
      navigate("/", { replace: true });
    },
    onError: (error) => {
      const message = generateErrorMessage(error);
      toast.error(message, {
        position: "bottom-right",
      });
    },
  });

  const isLoading = isUpdating || isCreating;

  function onSubmit(data: ProfileUpdateFormValues) {
    if (isSetup || !profile) {
      // 프로필 설정 완료 (기존 프로필 업데이트)
      createProfile({
        full_name: data.full_name,
        position: data.position,
        phone: data.phone,
      });
    } else {
      // 프로필 수정
      updateProfile({
        full_name: data.full_name,
        position: data.position,
        phone: data.phone,
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isSetup ? "프로필 설정" : "프로필 수정"}</CardTitle>
        <CardDescription>
          {isSetup
            ? "서비스를 이용하기 위해 프로필을 설정해주세요."
            : "프로필 정보를 수정할 수 있습니다."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldSet disabled={isLoading}>
            <FieldGroup>
              {/* Email (읽기 전용) */}
              <Field>
                <FieldLabel htmlFor="email">이메일</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  value={currentProfile?.email ?? profile?.email ?? ""}
                  disabled
                  className="bg-muted"
                />
                <FieldDescription>이메일은 변경할 수 없습니다.</FieldDescription>
              </Field>

              {/* Full Name */}
              <Field data-invalid={!!errors.full_name}>
                <FieldLabel htmlFor="full_name">이름</FieldLabel>
                <Input
                  id="full_name"
                  type="text"
                  placeholder="홍길동"
                  {...register("full_name")}
                />
                {errors.full_name ? (
                  <FieldError errors={[errors.full_name]} />
                ) : (
                  <FieldDescription>이름을 입력해주세요.</FieldDescription>
                )}
              </Field>

              {/* Position */}
              <Field data-invalid={!!errors.position}>
                <FieldLabel htmlFor="position">직책</FieldLabel>
                <Input
                  id="position"
                  type="text"
                  placeholder="예: 개발자, 디자이너"
                  {...register("position")}
                />
                {errors.position ? (
                  <FieldError errors={[errors.position]} />
                ) : (
                  <FieldDescription>직책을 입력해주세요.</FieldDescription>
                )}
              </Field>

              {/* Phone */}
              <Field data-invalid={!!errors.phone}>
                <FieldLabel htmlFor="phone">전화번호</FieldLabel>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="010-1234-5678"
                  {...register("phone")}
                />
                {errors.phone ? (
                  <FieldError errors={[errors.phone]} />
                ) : (
                  <FieldDescription>전화번호를 입력해주세요.</FieldDescription>
                )}
              </Field>

              <Field>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "처리 중..." : isSetup ? "프로필 설정 완료" : "프로필 수정"}
                </Button>
              </Field>
            </FieldGroup>
          </FieldSet>
        </form>
      </CardContent>
    </Card>
  );
}

