import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useUploadAnnouncementImage, useUploadAnnouncementFile } from "@/hooks/mutations/use-announcement";
import type { AnnouncementWithDetails } from "@/api/announcement";
import { X, Upload, Image as ImageIcon, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

type AnnouncementFormData = {
  title: string;
  content: string;
  image_url: string | null;
  is_active: boolean;
  expires_at: string | null;
};

type AnnouncementFormProps = {
  initialData?: AnnouncementWithDetails;
  onSubmit: (
    data: AnnouncementFormData,
    attachments: Array<{ file_name: string; file_url: string; file_size: number; file_type: string }>,
    deletedAttachmentIds?: string[]
  ) => Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
};

export function AnnouncementForm({ initialData, onSubmit, onCancel, isSubmitting = false }: AnnouncementFormProps) {
  const [formData, setFormData] = useState<AnnouncementFormData>({
    title: initialData?.title || "",
    content: initialData?.content || "",
    image_url: initialData?.image_url || null,
    is_active: initialData?.is_active ?? true,
    expires_at: initialData?.expires_at || null,
  });

  // 오늘 날짜를 YYYY-MM-DD 형식으로 가져오기
  const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // 다음날 날짜를 YYYY-MM-DD 형식으로 가져오기
  const getTomorrowDateString = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const day = String(tomorrow.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // 현재 시간을 HH:MM 형식으로 가져오기
  const getCurrentTimeString = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const [expiresAtDate, setExpiresAtDate] = useState<string>("");
  const [expiresAtTime, setExpiresAtTime] = useState<string>("");
  const [hasExpiry, setHasExpiry] = useState(!!initialData?.expires_at);
  const [imagePreview, setImagePreview] = useState<string | null>(initialData?.image_url || null);
  const [newAttachments, setNewAttachments] = useState<Array<{ id: string; file: File; preview: string; uploading?: boolean }>>([]);
  const [existingAttachments, setExistingAttachments] = useState(initialData?.attachments || []);
  const [deletedAttachmentIds, setDeletedAttachmentIds] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);

  const { mutate: uploadImage, isPending: isUploadingImage } = useUploadAnnouncementImage();
  const { mutate: uploadFile, mutateAsync: uploadFileAsync, isPending: isUploadingFile } = useUploadAnnouncementFile();

  useEffect(() => {
    if (initialData?.expires_at) {
      // UTC 시간을 로컬 시간으로 변환하여 표시
      const date = new Date(initialData.expires_at);
      // 로컬 시간대의 날짜와 시간을 가져옴
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      
      setExpiresAtDate(`${year}-${month}-${day}`);
      setExpiresAtTime(`${hours}:${minutes}`);
    }
  }, [initialData]);

  // 게시 종료 날짜 체크박스 변경 시 기본값 설정
  useEffect(() => {
    if (hasExpiry && !expiresAtDate && !initialData?.expires_at) {
      // 체크박스가 체크되고 날짜가 없으면 다음날 날짜와 현재 시간 설정
      setExpiresAtDate(getTomorrowDateString());
      setExpiresAtTime(getCurrentTimeString());
    }
  }, [hasExpiry, initialData]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 업로드 가능합니다.");
      e.target.value = ""; // 잘못된 파일 선택 시 input 리셋
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("이미지 크기는 10MB 이하여야 합니다.");
      e.target.value = ""; // 크기 초과 시 input 리셋
      return;
    }

    const preview = URL.createObjectURL(file);
    setImagePreview(preview);

    const announcementId = initialData?.id || "temp";
    uploadImage(
      { file, announcementId },
      {
        onSuccess: (url) => {
          setFormData((prev) => ({ ...prev, image_url: url }));
        },
        onError: () => {
          setImagePreview(formData.image_url);
        },
      }
    );

    // 이미지 선택 후 input value 리셋하여 같은 이미지를 다시 선택할 수 있도록 함
    e.target.value = "";
  };

  // 파일 처리 공통 함수
  const processFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    // 유효한 파일만 필터링
    const validFiles = fileArray.filter((file) => {
      if (file.size > 50 * 1024 * 1024) {
        alert(`${file.name}의 크기는 50MB 이하여야 합니다.`);
        return false;
      }
      return true;
    });

    // 모든 파일을 한 번에 상태에 추가 (배치 업데이트)
    const baseTimestamp = Date.now();
    const newFilesWithIds = validFiles.map((file, index) => {
      // 파일 이름, 크기, 마지막 수정 시간, 인덱스를 조합하여 고유 ID 생성
      // 인덱스를 추가하여 동시 업로드 시에도 고유성 보장
      const uniqueId = `${file.name}-${file.size}-${file.lastModified}-${baseTimestamp}-${index}-${Math.random()}`;
      return {
        id: uniqueId,
        file,
        preview: URL.createObjectURL(file), // 임시 미리보기 URL
        uploading: true,
      };
    });

    // 모든 파일을 한 번에 상태에 추가
    setNewAttachments((prev) => [...prev, ...newFilesWithIds]);

    // 각 파일을 병렬로 업로드 (mutateAsync 사용)
    const announcementId = initialData?.id || "temp";
    newFilesWithIds.forEach(async (fileWithId) => {
      try {
        // mutateAsync를 사용하여 Promise 반환
        const result = await uploadFileAsync({
          file: fileWithId.file,
          announcementId,
        });

        // 업로드 성공 시 해당 파일의 preview URL 업데이트 (ID로 찾기)
        setNewAttachments((prev) =>
          prev.map((att) =>
            att.id === fileWithId.id
              ? {
                  ...att,
                  preview: result.url,
                  uploading: false,
                }
              : att
          )
        );
      } catch (error) {
        // 업로드 실패 시 해당 파일 제거 (ID로 찾기)
        setNewAttachments((prev) => prev.filter((att) => att.id !== fileWithId.id));
        alert(`${fileWithId.file.name} 업로드에 실패했습니다.`);
      }
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
    // 파일 선택 후 input value를 먼저 리셋하여 같은 파일을 다시 선택할 수 있도록 함
    e.target.value = "";
  };

  // 드래그 앤 드롭 핸들러
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const removeImage = () => {
    setImagePreview(null);
    setFormData((prev) => ({ ...prev, image_url: null }));
  };

  const removeNewAttachment = (index: number) => {
    setNewAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingAttachment = (attachmentId: string) => {
    setExistingAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    // 삭제된 파일 ID를 추적하여 나중에 서버에서 삭제할 수 있도록 함
    setDeletedAttachmentIds((prev) => [...prev, attachmentId]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      alert("제목을 입력해주세요.");
      return;
    }

    if (!formData.content.trim()) {
      alert("내용을 입력해주세요.");
      return;
    }

    let expiresAt: string | null = null;
    if (hasExpiry && expiresAtDate) {
      if (expiresAtTime) {
        // 로컬 시간대의 날짜와 시간을 명시적으로 생성
        // 날짜와 시간 문자열을 파싱하여 로컬 시간으로 Date 객체 생성
        const [year, month, day] = expiresAtDate.split("-").map(Number);
        const [hours, minutes] = expiresAtTime.split(":").map(Number);
        
        // 로컬 시간대로 Date 객체 생성 (월은 0부터 시작하므로 -1)
        // 이 방법은 브라우저의 로컬 시간대를 자동으로 사용합니다
        const localDate = new Date(year, month - 1, day, hours, minutes, 0);
        
        // UTC로 변환하여 ISO 문자열로 저장 (데이터베이스는 UTC로 저장)
        expiresAt = localDate.toISOString();
      } else {
        // 시간이 없으면 해당 날짜의 23:59:59 (로컬 시간)를 UTC로 변환
        const [year, month, day] = expiresAtDate.split("-").map(Number);
        const localDate = new Date(year, month - 1, day, 23, 59, 59);
        expiresAt = localDate.toISOString();
      }
    }

    // 업로드가 완료된 첨부파일만 제출
    const attachments = newAttachments
      .filter((att) => !att.uploading) // 업로드 중인 파일 제외
      .map((att) => ({
        file_name: att.file.name,
        file_url: att.preview,
        file_size: att.file.size,
        file_type: att.file.type,
      }));

    // 업로드 중인 파일이 있으면 제출 방지
    const hasUploadingFiles = newAttachments.some((att) => att.uploading);
    if (hasUploadingFiles) {
      alert("파일 업로드가 완료될 때까지 기다려주세요.");
      return;
    }

    await onSubmit(
      {
        ...formData,
        expires_at: expiresAt,
      },
      attachments,
      deletedAttachmentIds.length > 0 ? deletedAttachmentIds : undefined
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 제목 */}
      <Field>
        <FieldLabel>제목 *</FieldLabel>
        <FieldContent>
          <Input
            value={formData.title}
            onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="공지사항 제목을 입력하세요"
            required
            maxLength={200}
          />
        </FieldContent>
      </Field>

      {/* 내용 */}
      <Field>
        <FieldLabel>내용 *</FieldLabel>
        <FieldContent>
          <Textarea
            value={formData.content}
            onChange={(e) => setFormData((prev) => ({ ...prev, content: e.target.value }))}
            placeholder="공지사항 내용을 입력하세요"
            required
            rows={8}
            className="min-h-[200px]"
          />
        </FieldContent>
      </Field>

      {/* 이미지 업로드 */}
      <Field>
        <FieldLabel>이미지</FieldLabel>
        <FieldContent>
          {imagePreview ? (
            <div className="relative w-full max-w-md">
              <img src={imagePreview} alt="Preview" className="rounded-lg border object-contain w-full h-auto max-h-64" />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2"
                onClick={removeImage}
                disabled={isUploadingImage}
              >
                <X className="size-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <Label htmlFor="image-upload" className="cursor-pointer">
                <div className="flex items-center gap-2 rounded-md border p-3 hover:bg-accent">
                  <ImageIcon className="size-4" />
                  <span className="text-sm">이미지 선택</span>
                </div>
              </Label>
              <Input
                id="image-upload"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                disabled={isUploadingImage}
              />
              {isUploadingImage && <span className="text-sm text-muted-foreground">업로드 중...</span>}
            </div>
          )}
          <FieldDescription>최대 10MB, JPG, PNG, GIF 형식 지원</FieldDescription>
        </FieldContent>
      </Field>

      {/* 파일 첨부 */}
      <Field>
        <FieldLabel>첨부파일</FieldLabel>
        <FieldContent>
          <div className="space-y-2">
            {/* 기존 첨부파일 */}
            {existingAttachments.map((attachment) => (
              <div key={attachment.id} className="flex items-center justify-between rounded-md border p-2">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-muted-foreground" />
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      
                      if (!attachment.file_url || !attachment.file_name) return;

                      try {
                        // 파일을 fetch로 가져오기
                        const response = await fetch(attachment.file_url);
                        if (!response.ok) {
                          throw new Error("파일 다운로드 실패");
                        }

                        // Blob으로 변환
                        const blob = await response.blob();

                        // 다운로드 링크 생성 (원본 파일명 사용)
                        const url = window.URL.createObjectURL(blob);
                        const link = document.createElement("a");
                        link.href = url;
                        link.download = attachment.file_name;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);

                        // 메모리 정리
                        window.URL.revokeObjectURL(url);
                      } catch (error) {
                        console.error("파일 다운로드 실패:", error);
                        alert("파일 다운로드에 실패했습니다.");
                      }
                    }}
                    className="text-sm hover:underline text-left"
                  >
                    {attachment.file_name}
                  </button>
                  {attachment.file_size && (
                    <span className="text-xs text-muted-foreground">
                      ({(attachment.file_size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeExistingAttachment(attachment.id)}
                  disabled={isSubmitting}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}

            {/* 새 첨부파일 */}
            {newAttachments.map((attachment) => (
              <div key={attachment.id} className="flex items-center justify-between rounded-md border p-2">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-muted-foreground" />
                  <span className="text-sm">{attachment.file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({(attachment.file.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                  {attachment.uploading && (
                    <span className="text-xs text-muted-foreground">업로드 중...</span>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeNewAttachment(newAttachments.findIndex((att) => att.id === attachment.id))}
                  disabled={isSubmitting || attachment.uploading}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}

            {/* 드래그 앤 드롭 영역 */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={cn(
                "relative rounded-lg border-2 border-dashed transition-colors",
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              )}
            >
              <Label htmlFor="file-upload" className="flex cursor-pointer flex-col items-center justify-center gap-2 p-6">
                <Upload className={cn("size-8 text-muted-foreground", dragActive && "text-primary")} />
                <div className="text-center">
                  <span className="text-sm font-medium">
                    {dragActive ? "파일을 여기에 놓으세요" : "파일을 드래그하거나 클릭하여 선택하세요"}
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">
                    여러 파일 선택 가능
                  </p>
                </div>
              </Label>
              <Input
                id="file-upload"
                type="file"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isUploadingFile}
                multiple
              />
            </div>
            {isUploadingFile && <span className="text-sm text-muted-foreground">업로드 중...</span>}
          </div>
          <FieldDescription>최대 50MB, 여러 파일 선택 가능</FieldDescription>
        </FieldContent>
      </Field>

      {/* 게시 종료 날짜 */}
      <Field>
        <FieldContent>
          <div className="flex items-center gap-2">
            <Checkbox
              id="has-expiry"
              checked={hasExpiry}
              onCheckedChange={(checked) => {
                setHasExpiry(!!checked);
                if (!checked) {
                  setExpiresAtDate("");
                  setExpiresAtTime("");
                }
              }}
            />
            <Label htmlFor="has-expiry" className="cursor-pointer">
              게시 종료 날짜 설정
            </Label>
          </div>
          {hasExpiry && (
            <div className="mt-2 flex gap-2">
              <Input
                type="date"
                value={expiresAtDate}
                onChange={(e) => setExpiresAtDate(e.target.value)}
                min={getTodayDateString()}
                className="flex-1"
              />
              <Input
                type="time"
                value={expiresAtTime}
                onChange={(e) => setExpiresAtTime(e.target.value)}
                className="w-32"
              />
            </div>
          )}
        </FieldContent>
      </Field>

      {/* 활성화 상태 */}
      <Field>
        <FieldContent>
          <div className="flex items-center gap-2">
            <Checkbox
              id="is-active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_active: !!checked }))}
            />
            <Label htmlFor="is-active" className="cursor-pointer">
              즉시 게시
            </Label>
          </div>
          <FieldDescription>체크 해제 시 비활성 상태로 저장됩니다</FieldDescription>
        </FieldContent>
      </Field>

      {/* 버튼 */}
      <div className="flex justify-end gap-2 pt-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            취소
          </Button>
        )}
        <Button 
          type="submit" 
          disabled={
            isSubmitting || 
            isUploadingImage || 
            isUploadingFile || 
            newAttachments.some((att) => att.uploading)
          }
        >
          {isSubmitting ? "저장 중..." : initialData ? "수정" : "생성"}
        </Button>
      </div>
    </form>
  );
}
