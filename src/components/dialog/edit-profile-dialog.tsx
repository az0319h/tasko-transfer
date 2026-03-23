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
  profileUpdateSchema,
  type ProfileUpdateFormValues,
} from "@/schemas/profile/profile-schema";
import { useUpdateProfile, useCurrentProfile } from "@/hooks";
import { toast } from "sonner";
import { generateErrorMessage } from "@/lib/error";
import { useState, useEffect, useRef } from "react";
import { ProfileAvatar } from "@/components/common/profile-avatar";
import { ImageCropDialog } from "./image-crop-dialog";
import { uploadAvatar, deleteAvatar } from "@/api/storage";
import { Camera, Trash2 } from "lucide-react";

export default function EditProfileDialog({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: currentProfile } = useCurrentProfile();
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<ProfileUpdateFormValues>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      full_name: "",
      position: "",
      phone: "",
    },
  });

  const positionValue = watch("position");

  // 다이얼로그가 열릴 때 프로필 데이터로 폼 초기화
  useEffect(() => {
    if (open && currentProfile) {
      reset({
        full_name: currentProfile.full_name ?? "",
        position: currentProfile.position ?? "",
        phone: currentProfile.phone ?? "",
      });
    }
  }, [open, currentProfile, reset]);

  const { mutate: updateProfile, isPending } = useUpdateProfile({
    onSuccess: () => {
      toast.success("프로필이 수정되었습니다.", {
        position: "bottom-right",
      });
      setOpen(false);
    },
    onError: (error) => {
      const message = generateErrorMessage(error);
      toast.error(message, {
        position: "bottom-right",
      });
    },
  });

  // 이미지만 업로드하는 mutation (모달을 닫지 않음)
  const { mutate: updateProfileAvatar, isPending: isUpdatingAvatar } = useUpdateProfile({
    onSuccess: () => {
      toast.success("프로필 이미지가 업로드되었습니다.", {
        position: "bottom-right",
      });
      // 모달을 닫지 않음
    },
    onError: (error) => {
      const message = generateErrorMessage(error);
      toast.error(message, {
        position: "bottom-right",
      });
    },
  });

  // 이미지 삭제하는 mutation (모달을 닫지 않음)
  const { mutate: deleteProfileAvatar, isPending: isDeletingAvatar } = useUpdateProfile({
    onSuccess: () => {
      toast.success("프로필 이미지가 삭제되었습니다.", {
        position: "bottom-right",
      });
      // 모달을 닫지 않음
    },
    onError: (error) => {
      const message = generateErrorMessage(error);
      toast.error(message, {
        position: "bottom-right",
      });
    },
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 파일 타입 검증
    if (!file.type.startsWith("image/")) {
      toast.error("이미지 파일만 업로드할 수 있습니다.", {
        position: "bottom-right",
      });
      return;
    }

    // 파일 크기 검증 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("파일 크기는 5MB 이하여야 합니다.", {
        position: "bottom-right",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setCropDialogOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (croppedImageBlob: Blob) => {
    if (!currentProfile) return;

    try {
      const file = new File([croppedImageBlob], "avatar.jpg", {
        type: "image/jpeg",
      });
      const avatarUrl = await uploadAvatar(file, currentProfile.id);
      // 이미지만 업로드하는 mutation 사용 (모달을 닫지 않음)
      updateProfileAvatar({
        full_name: currentProfile.full_name ?? "",
        position: currentProfile.position ?? "",
        phone: currentProfile.phone ?? "",
        avatar_url: avatarUrl,
      });
    } catch (error) {
      const message = generateErrorMessage(error);
      toast.error(message, {
        position: "bottom-right",
      });
    }
  };

  const handleDeleteImage = async () => {
    if (!currentProfile?.avatar_url) return;

    try {
      // Storage에서 이미지 삭제
      await deleteAvatar(currentProfile.avatar_url);
      // 프로필에서 avatar_url 제거
      deleteProfileAvatar({
        full_name: currentProfile.full_name ?? "",
        position: currentProfile.position ?? "",
        phone: currentProfile.phone ?? "",
        avatar_url: null,
      });
    } catch (error) {
      const message = generateErrorMessage(error);
      toast.error(message, {
        position: "bottom-right",
      });
    }
  };

  function onSubmit(data: ProfileUpdateFormValues) {
    updateProfile({
      full_name: data.full_name,
      position: data.position,
      phone: data.phone,
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>프로필 수정</DialogTitle>
          <DialogDescription>프로필 정보를 수정할 수 있습니다.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldSet disabled={isPending || isUpdatingAvatar || isDeletingAvatar}>
            <FieldGroup>
              {/* Profile Image */}
              <Field>
                <FieldLabel>프로필 이미지</FieldLabel>
                <div className="flex items-center gap-4">
                  <ProfileAvatar avatarUrl={currentProfile?.avatar_url} size={80} />
                  <div className="flex flex-col gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="py-1 sm:py-1.5"
                        disabled={isPending || isUpdatingAvatar || isDeletingAvatar}
                      >
                        <Camera className="mr-2 size-4" />
                        이미지 변경
                      </Button>
                      {currentProfile?.avatar_url && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleDeleteImage}
                          disabled={isPending || isUpdatingAvatar || isDeletingAvatar}
                        >
                          <Trash2 className="mr-2 size-4" />
                          이미지 삭제
                        </Button>
                      )}
                    </div>
                    <FieldDescription>JPG, PNG, WEBP 형식, 최대 5MB</FieldDescription>
                  </div>
                </div>
              </Field>

              {/* Email (읽기 전용) */}
              <Field>
                <FieldLabel htmlFor="email">이메일</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  value={currentProfile?.email ?? ""}
                  disabled
                  className="bg-muted"
                />
                <FieldDescription>이메일은 변경할 수 없습니다.</FieldDescription>
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
            </FieldGroup>
          </FieldSet>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                취소
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "수정 중..." : "수정"}
            </Button>
          </DialogFooter>
        </form>

        <ImageCropDialog
          open={cropDialogOpen}
          onOpenChange={setCropDialogOpen}
          imageSrc={imageSrc}
          onCropComplete={handleCropComplete}
        />
      </DialogContent>
    </Dialog>
  );
}
