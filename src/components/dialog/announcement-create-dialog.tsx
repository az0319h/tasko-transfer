import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AnnouncementForm } from "@/components/announcement/announcement-form";
import { useCreateAnnouncement } from "@/hooks/mutations/use-announcement";
import { useQueryClient } from "@tanstack/react-query";

type AnnouncementCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AnnouncementCreateDialog({
  open,
  onOpenChange,
}: AnnouncementCreateDialogProps) {
  const { mutate: createAnnouncement, isPending } = useCreateAnnouncement();
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
    }>
  ) => {
    setIsSubmitting(true);
    createAnnouncement(
      {
        announcement: {
          title: data.title,
          content: data.content,
          image_url: data.image_url,
          is_active: data.is_active,
          expires_at: data.expires_at,
        },
        attachments: attachments.length > 0 ? attachments : undefined,
      },
      {
        onSuccess: () => {
          // 공지사항 목록 쿼리 무효화하여 새로고침
          queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
          queryClient.invalidateQueries({ queryKey: ["announcements"] });
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-200 w-9/10 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>공지사항 작성</DialogTitle>
          <DialogDescription>새로운 공지사항을 작성하세요</DialogDescription>
        </DialogHeader>
        <AnnouncementForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={isPending || isSubmitting}
        />
      </DialogContent>
    </Dialog>
  );
}