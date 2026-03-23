import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { X, Image as ImageIcon, Video, Plus, Trash2 } from "lucide-react";
import type { Agent } from "@/types/domain/agent";
import supabase from "@/lib/supabase";
import { agentCreateSchema, agentUpdateSchema, type AgentCreateFormValues, type AgentUpdateFormValues } from "@/schemas/agent/agent-schema";

// AgentFormData 타입을 export하여 다른 컴포넌트에서 사용할 수 있도록 함
export type AgentFormData = {
  name: string;
  description: string;
  detailed_description: string;
  features: string[];
  site_url: string;
  site_media_file: File | null;
  site_media_type: "image" | "video" | null;
  site_media_url: string | null; // 기존 미디어 URL (수정 모드)
};

type AgentFormProps = {
  initialData?: Agent;
  onSubmit: (data: AgentFormData) => Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
};

export function AgentForm({ initialData, onSubmit, onCancel, isSubmitting = false }: AgentFormProps) {
  const isEditMode = !!initialData;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [newFeature, setNewFeature] = useState("");

  const formSchema = isEditMode ? agentUpdateSchema : agentCreateSchema;

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<AgentCreateFormValues | AgentUpdateFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
      detailed_description: initialData?.detailed_description || "",
      features: initialData?.features || [],
      site_url: initialData?.site_url || "",
      site_media_file: undefined,
      site_media_type: undefined,
    } as AgentCreateFormValues | AgentUpdateFormValues,
  });

  const watchedFeatures = watch("features");
  const watchedMediaFile = watch("site_media_file");
  const watchedMediaType = watch("site_media_type");

  // 초기 데이터 설정
  useEffect(() => {
    if (initialData) {
      reset({
        name: initialData.name,
        description: initialData.description,
        detailed_description: initialData.detailed_description || "",
        features: initialData.features || [],
        site_url: initialData.site_url || "",
        site_media_file: undefined,
        site_media_type: undefined,
      } as AgentUpdateFormValues);

      // 기존 미디어 미리보기 설정
      if (initialData.site_media_url) {
        const {
          data: { publicUrl },
        } = supabase.storage.from("agents").getPublicUrl(initialData.site_media_url);
        setMediaPreview(publicUrl);
      }
    }
  }, [initialData, reset]);

  // 미디어 파일 선택 핸들러
  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      // 파일 선택 취소 시, 수정 모드에서는 기존 미디어 타입도 초기화하지 않음
      // (기존 미디어를 유지하기 위해)
      return;
    }

    // 파일 타입 검증
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
      alert("이미지 또는 비디오 파일만 업로드 가능합니다.");
      e.target.value = "";
      return;
    }

    // 파일 크기 검증
    const maxSize = isImage ? 10 * 1024 * 1024 : 100 * 1024 * 1024; // 이미지: 10MB, 비디오: 100MB
    if (file.size > maxSize) {
      alert(`${isImage ? "이미지" : "비디오"} 크기는 ${isImage ? "10MB" : "100MB"} 이하여야 합니다.`);
      e.target.value = "";
      return;
    }

    // react-hook-form에 값 설정 (먼저 설정)
    setValue("site_media_file", file, { shouldValidate: true });
    setValue("site_media_type", isImage ? "image" : "video", { shouldValidate: true });

    // 미리보기 생성 (값 설정 후)
    const preview = URL.createObjectURL(file);
    setMediaPreview(preview);

    e.target.value = "";
  };

  // 미디어 삭제 핸들러
  const handleRemoveMedia = () => {
    // 새로 선택한 파일이 있으면 제거하고 기존 미디어로 되돌림
    if (watchedMediaFile) {
      // 새 파일 제거
      setValue("site_media_file", undefined, { shouldValidate: false });
      setValue("site_media_type", undefined, { shouldValidate: false });
      
      // 기존 미디어 미리보기 복원
      if (isEditMode && initialData?.site_media_url) {
        const {
          data: { publicUrl },
        } = supabase.storage.from("agents").getPublicUrl(initialData.site_media_url);
        setMediaPreview(publicUrl);
      } else {
        setMediaPreview(null);
      }
    } else if (isEditMode && initialData?.site_media_url) {
      // 기존 미디어만 있는 경우 (수정 모드에서 기존 미디어 제거)
      setMediaPreview(null);
      setValue("site_media_file", undefined, { shouldValidate: false });
      setValue("site_media_type", undefined, { shouldValidate: false });
    } else {
      // 생성 모드에서 완전히 제거
      setMediaPreview(null);
      setValue("site_media_file", undefined, { shouldValidate: true });
      setValue("site_media_type", undefined, { shouldValidate: true });
    }
  };

  // 특징 추가 핸들러
  const handleAddFeature = () => {
    if (!newFeature.trim()) return;
    const currentFeatures = watch("features") || [];
    if (currentFeatures.length >= 20) {
      alert("특징은 최대 20개까지 추가할 수 있습니다.");
      return;
    }
    setValue("features", [...currentFeatures, newFeature.trim()], { shouldValidate: true });
    setNewFeature("");
  };

  // 특징 삭제 핸들러
  const handleRemoveFeature = (index: number) => {
    const currentFeatures = watch("features") || [];
    setValue(
      "features",
      currentFeatures.filter((_, i) => i !== index),
      { shouldValidate: true }
    );
  };

  // 특징 수정 핸들러
  const handleUpdateFeature = (index: number, value: string) => {
    const currentFeatures = watch("features") || [];
    setValue(
      "features",
      currentFeatures.map((f, i) => (i === index ? value : f)),
      { shouldValidate: true }
    );
  };

  // 폼 제출 핸들러
  const onSubmitForm = async (data: AgentCreateFormValues | AgentUpdateFormValues) => {
    // AgentFormData 형식으로 변환
    const formData: AgentFormData = {
      name: data.name,
      description: data.description,
      detailed_description: data.detailed_description,
      features: data.features,
      site_url: data.site_url,
      site_media_file: data.site_media_file || null,
      site_media_type: data.site_media_type || null,
      site_media_url: initialData?.site_media_url || null,
    };

    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-6">
      {/* 에이전트 이름 */}
      <Field>
        <FieldLabel>에이전트 이름 *</FieldLabel>
        <FieldContent>
          <Input
            {...register("name")}
            placeholder="에이전트 이름을 입력하세요"
            maxLength={100}
            disabled={isSubmitting}
          />
          {errors.name && <FieldError>{errors.name.message}</FieldError>}
        </FieldContent>
      </Field>

      {/* 간략한 설명 */}
      <Field>
        <FieldLabel>간략한 설명 *</FieldLabel>
        <FieldDescription>목록 페이지에 표시되는 간단한 설명입니다.</FieldDescription>
        <FieldContent>
          <Textarea
            {...register("description")}
            placeholder="에이전트에 대한 간단한 설명을 입력하세요"
            rows={3}
            maxLength={500}
            disabled={isSubmitting}
          />
          {errors.description && <FieldError>{errors.description.message}</FieldError>}
        </FieldContent>
      </Field>

      {/* 구체적인 설명 */}
      <Field>
        <FieldLabel>구체적인 설명 *</FieldLabel>
        <FieldDescription>상세 페이지에 표시되는 자세한 설명입니다.</FieldDescription>
        <FieldContent>
          <Textarea
            {...register("detailed_description")}
            placeholder="에이전트에 대한 자세한 설명을 입력하세요"
            rows={6}
            maxLength={5000}
            disabled={isSubmitting}
          />
          {errors.detailed_description && <FieldError>{errors.detailed_description.message}</FieldError>}
        </FieldContent>
      </Field>

      {/* 에이전트 사이트 URL */}
      <Field>
        <FieldLabel>에이전트 사이트 URL *</FieldLabel>
        <FieldDescription>에이전트 확인하기 버튼에 사용될 URL입니다.</FieldDescription>
        <FieldContent>
          <Input
            type="url"
            {...register("site_url")}
            placeholder="https://example.com"
            disabled={isSubmitting}
          />
          {errors.site_url && <FieldError>{errors.site_url.message}</FieldError>}
        </FieldContent>
      </Field>

      {/* 대표 미디어 */}
      <Field>
        <FieldLabel>대표 미디어 {isEditMode ? "" : "*"}</FieldLabel>
        <FieldDescription>
          {isEditMode
            ? "이미지 또는 비디오를 업로드할 수 있습니다. 업로드하지 않으면 기존 미디어가 유지됩니다. (이미지: 최대 10MB, 비디오: 최대 100MB)"
            : "이미지 또는 비디오를 업로드할 수 있습니다. (이미지: 최대 10MB, 비디오: 최대 100MB)"}
        </FieldDescription>
        <FieldContent>
          {watchedMediaFile ? (
            <div className="relative">
              <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
                {watchedMediaType === "image" ? (
                  <img src={URL.createObjectURL(watchedMediaFile)} alt="미리보기" className="h-full w-full object-cover" />
                ) : watchedMediaType === "video" ? (
                  <video src={URL.createObjectURL(watchedMediaFile)} className="h-full w-full object-cover" controls />
                ) : null}
              </div>
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute right-2 top-2"
                onClick={handleRemoveMedia}
                disabled={isSubmitting}
              >
                <X className="size-4" />
              </Button>
            </div>
          ) : mediaPreview && isEditMode ? (
            <div className="relative">
              <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
                {initialData?.site_media_type === "image" ? (
                  <img src={mediaPreview} alt="기존 미디어" className="h-full w-full object-cover" />
                ) : initialData?.site_media_type === "video" ? (
                  <video src={mediaPreview} className="h-full w-full object-cover" controls />
                ) : null}
              </div>
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute right-2 top-2"
                onClick={handleRemoveMedia}
                disabled={isSubmitting}
              >
                <X className="size-4" />
              </Button>
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // 이미지 파일만 선택하도록 accept 속성 설정
                    if (fileInputRef.current) {
                      fileInputRef.current.accept = "image/*";
                      fileInputRef.current.click();
                    }
                  }}
                  disabled={isSubmitting}
                >
                  <ImageIcon className="mr-2 size-4" />
                  이미지 변경
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // 비디오 파일만 선택하도록 accept 속성 설정
                    if (fileInputRef.current) {
                      fileInputRef.current.accept = "video/*";
                      fileInputRef.current.click();
                    }
                  }}
                  disabled={isSubmitting}
                >
                  <Video className="mr-2 size-4" />
                  비디오 변경
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    // 이미지 파일만 선택하도록 accept 속성 설정
                    if (fileInputRef.current) {
                      fileInputRef.current.accept = "image/*";
                      fileInputRef.current.click();
                    }
                  }}
                  disabled={isSubmitting}
                >
                  <ImageIcon className="mr-2 size-4" />
                  이미지 업로드
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    // 비디오 파일만 선택하도록 accept 속성 설정
                    if (fileInputRef.current) {
                      fileInputRef.current.accept = "video/*";
                      fileInputRef.current.click();
                    }
                  }}
                  disabled={isSubmitting}
                >
                  <Video className="mr-2 size-4" />
                  비디오 업로드
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleMediaSelect}
                className="hidden"
                disabled={isSubmitting}
                onClick={(e) => {
                  // 클릭 시 accept 속성을 초기화하여 모든 미디어 타입 선택 가능하도록 함
                  const target = e.target as HTMLInputElement;
                  if (target) {
                    target.accept = "image/*,video/*";
                  }
                }}
              />
              {errors.site_media_file && <FieldError>{errors.site_media_file.message}</FieldError>}
              {errors.site_media_type && <FieldError>{errors.site_media_type.message}</FieldError>}
            </div>
          )}
        </FieldContent>
      </Field>

      {/* 특징 리스트 */}
      <Field>
        <FieldLabel>에이전트 특징 *</FieldLabel>
        <FieldDescription>에이전트의 주요 특징을 추가하세요. (최소 1개 이상, 최대 20개)</FieldDescription>
        <FieldContent>
          <div className="space-y-3">
            {watchedFeatures?.map((feature, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={feature}
                  onChange={(e) => handleUpdateFeature(index, e.target.value)}
                  placeholder={`특징 ${index + 1}`}
                  maxLength={200}
                  disabled={isSubmitting}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveFeature(index)}
                  disabled={isSubmitting}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            {(!watchedFeatures || watchedFeatures.length < 20) && (
              <div className="flex items-center gap-2">
                <Input
                  value={newFeature}
                  onChange={(e) => setNewFeature(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddFeature();
                    }
                  }}
                  placeholder="새로운 특징을 입력하고 Enter를 누르세요"
                  maxLength={200}
                  disabled={isSubmitting}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddFeature}
                  disabled={isSubmitting || !newFeature.trim()}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            )}
          </div>
          {errors.features && <FieldError>{errors.features.message}</FieldError>}
        </FieldContent>
      </Field>

      {/* 버튼 */}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            취소
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "저장 중..." : isEditMode ? "수정" : "생성"}
        </Button>
      </div>
    </form>
  );
}
