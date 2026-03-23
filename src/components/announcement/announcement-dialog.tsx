import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useDismissAnnouncement } from "@/hooks/mutations/use-announcement";
import type { AnnouncementWithDetails } from "@/api/announcement";
import { X, FileText, Download } from "lucide-react";
type AnnouncementDialogProps = {
  announcement: AnnouncementWithDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AnnouncementDialog({ announcement, open, onOpenChange }: AnnouncementDialogProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const { mutate: dismissAnnouncement, isPending } = useDismissAnnouncement();

  const handleClose = () => {
    if (dontShowAgain) {
      dismissAnnouncement(announcement.id, {
        onSuccess: () => {
          onOpenChange(false);
        },
      });
    } else {
      onOpenChange(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      return `${year}년 ${month}월 ${day}일 ${hours}:${minutes}`;
    } catch {
      return dateString;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-200 w-9/10 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{announcement.title}</DialogTitle>
          <DialogDescription className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{announcement.created_by_profile?.full_name || announcement.created_by_profile?.email || "관리자"}</span>
            <span>•</span>
            <span>{formatDate(announcement.created_at)}</span>
            {announcement.expires_at && (
              <>
                <span>•</span>
                <span>종료: {formatDate(announcement.expires_at)}</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 이미지 */}
          {announcement.image_url && (
            <div className="w-full">
              <img
                src={announcement.image_url}
                alt={announcement.title}
                className="rounded-lg border object-contain w-full h-auto max-h-96"
              />
            </div>
          )}

          {/* 내용 */}
          <div className="prose prose-sm max-w-none">
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{announcement.content}</div>
          </div>

          {/* 첨부파일 */}
          {announcement.attachments && announcement.attachments.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">첨부파일</h4>
              <div className="space-y-2">
                {announcement.attachments.map((attachment) => (
                  <button
                    key={attachment.id}
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
                    className="w-full flex items-center gap-2 rounded-md border p-3 hover:bg-accent transition-colors text-left"
                  >
                    <FileText className="size-4 text-muted-foreground" />
                    <span className="flex-1 text-sm">{attachment.file_name}</span>
                    {attachment.file_size && (
                      <span className="text-xs text-muted-foreground">
                        ({(attachment.file_size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    )}
                    <Download className="size-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 다시 보지 않음 체크박스 */}
          <div className="flex items-center gap-2 pt-2 border-t">
            <Checkbox
              id="dont-show-again"
              checked={dontShowAgain}
              onCheckedChange={(checked) => setDontShowAgain(!!checked)}
            />
            <Label htmlFor="dont-show-again" className="cursor-pointer text-sm">
              다시 보지 않음
            </Label>
          </div>
        </div>

        {/* 닫기 버튼 */}
        <div className="flex justify-end pt-4">
          <Button onClick={handleClose} disabled={isPending}>
            {isPending ? "처리 중..." : "확인"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
