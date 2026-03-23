import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  toggleAnnouncementActive,
  dismissAnnouncement,
  uploadAnnouncementFile,
  uploadAnnouncementImage,
  deleteAnnouncementAttachment,
  type AnnouncementInsert,
  type AnnouncementUpdate,
  type AnnouncementWithDetails,
} from "@/api/announcement";
import { toast } from "sonner";

/**
 * 공지사항 생성 뮤테이션 훅 (관리자만 가능)
 */
export function useCreateAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      announcement,
      attachments,
    }: {
      announcement: Omit<AnnouncementInsert, "created_by">;
      attachments?: Array<{ file_name: string; file_url: string; file_size: number; file_type: string }>;
    }) => createAnnouncement(announcement, attachments),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      toast.success("공지사항이 생성되었습니다.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "공지사항 생성에 실패했습니다.");
    },
  });
}

/**
 * 공지사항 수정 뮤테이션 훅 (관리자만 가능)
 */
export function useUpdateAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      updates,
      attachments,
      deletedAttachmentIds,
    }: {
      id: string;
      updates: AnnouncementUpdate;
      attachments?: Array<{ file_name: string; file_url: string; file_size: number; file_type: string }>;
      deletedAttachmentIds?: string[];
    }) => updateAnnouncement(id, updates, attachments, deletedAttachmentIds),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      queryClient.invalidateQueries({ queryKey: ["announcements", "detail", data.id] });
      toast.success("공지사항이 수정되었습니다.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "공지사항 수정에 실패했습니다.");
    },
  });
}

/**
 * 공지사항 삭제 뮤테이션 훅 (관리자만 가능)
 */
export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteAnnouncement(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      toast.success("공지사항이 삭제되었습니다.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "공지사항 삭제에 실패했습니다.");
    },
  });
}

/**
 * 공지사항 활성화 토글 뮤테이션 훅 (관리자만 가능)
 */
export function useToggleAnnouncementActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => toggleAnnouncementActive(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      queryClient.invalidateQueries({ queryKey: ["announcements", "detail", data.id] });
      toast.success(data.is_active ? "공지사항이 활성화되었습니다." : "공지사항이 비활성화되었습니다.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "공지사항 활성화 토글에 실패했습니다.");
    },
  });
}

/**
 * 공지사항 "다시 보지 않음" 처리 뮤테이션 훅
 */
export function useDismissAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (announcementId: string) => dismissAnnouncement(announcementId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements", "active"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || '"다시 보지 않음" 처리에 실패했습니다.');
    },
  });
}

/**
 * 공지사항 파일 업로드 뮤테이션 훅 (관리자만 가능)
 */
export function useUploadAnnouncementFile() {
  return useMutation({
    mutationFn: ({ file, announcementId }: { file: File; announcementId: string }) =>
      uploadAnnouncementFile(file, announcementId),
    onError: (error: Error) => {
      toast.error(error.message || "파일 업로드에 실패했습니다.");
    },
  });
}

/**
 * 공지사항 이미지 업로드 뮤테이션 훅 (관리자만 가능)
 */
export function useUploadAnnouncementImage() {
  return useMutation({
    mutationFn: ({ file, announcementId }: { file: File; announcementId: string }) =>
      uploadAnnouncementImage(file, announcementId),
    onError: (error: Error) => {
      toast.error(error.message || "이미지 업로드에 실패했습니다.");
    },
  });
}

/**
 * 공지사항 첨부파일 삭제 뮤테이션 훅 (관리자만 가능)
 */
export function useDeleteAnnouncementAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (attachmentId: string) => deleteAnnouncementAttachment(attachmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      toast.success("첨부파일이 삭제되었습니다.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "첨부파일 삭제에 실패했습니다.");
    },
  });
}
