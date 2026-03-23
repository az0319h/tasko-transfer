import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AnnouncementForm } from "@/components/announcement/announcement-form";
import { useAnnouncement } from "@/hooks/queries/use-announcement";
import { useUpdateAnnouncement } from "@/hooks/mutations/use-announcement";
import { useQueryClient } from "@tanstack/react-query";
import DefaultSpinner from "@/components/common/default-spinner";

type AnnouncementEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  announcementId: string | null;
};

export function AnnouncementEditDialog({
  open,
  onOpenChange,
  announcementId,
}: AnnouncementEditDialogProps) {
  const { data: announcement, isLoading } = useAnnouncement(announcementId || undefined);
  const { mutate: updateAnnouncement, isPending } = useUpdateAnnouncement();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const handleSubmit = async (
    data: {
      title: string;
      content: string;
      image_url: string | null;
      is_active: boolean;
      expires_at: string | null;
    },
    attachments: Array<{
      file_name: string;
      file_url: string;
      file_size: number;
      file_type: string;
    }>,
    deletedAttachmentIds?: string[]
  ) => {
    if (!announcementId) return;

    setIsSubmitting(true);
    updateAnnouncement(
      {
        id: announcementId,
        updates: {
          title: data.title,
          content: data.content,
          image_url: data.image_url,
          is_active: data.is_active,
          expires_at: data.expires_at,
        },
        attachments: attachments.length > 0 ? attachments : undefined,
        deletedAttachmentIds: deletedAttachmentIds,
      },
      {
        onSuccess: () => {
          // 공지사항 목록 쿼리 무효화하여 새로고침
          queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
          queryClient.invalidateQueries({ queryKey: ["announcements"] });
          queryClient.invalidateQueries({ queryKey: ["announcements", "detail", announcementId] });
          setIsSubmitting(false);
          onOpenChange(false);
        },
        onError: () => {
          setIsSubmitting(false);
        },
      }
    );
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open && !!announcementId} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-200 w-9/10 max-h-[90vh] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <DefaultSpinner />
          </div>
        ) : !announcement ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">공지사항을 찾을 수 없습니다.</p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>공지사항 수정</DialogTitle>
              <DialogDescription>공지사항을 수정하세요</DialogDescription>
            </DialogHeader>
            <AnnouncementForm
              initialData={announcement}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              isSubmitting={isPending || isSubmitting}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
