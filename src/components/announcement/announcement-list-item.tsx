import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDeleteAnnouncement, useToggleAnnouncementActive, useDeleteAnnouncementAttachment } from "@/hooks/mutations/use-announcement";
import type { AnnouncementWithDetails } from "@/api/announcement";
import { MoreVertical, Edit, Trash2, FileText, Download } from "lucide-react";

type AnnouncementListItemProps = {
  announcement: AnnouncementWithDetails;
  onEdit?: (id: string) => void;
};

export function AnnouncementListItem({ announcement, onEdit }: AnnouncementListItemProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { mutate: deleteAnnouncement } = useDeleteAnnouncement();
  const { mutate: toggleActive } = useToggleAnnouncementActive();
  const { mutate: deleteAttachment } = useDeleteAnnouncementAttachment();

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      return `${year}-${month}-${day} ${hours}:${minutes}`;
    } catch {
      return dateString;
    }
  };

  const handleDelete = () => {
    deleteAnnouncement(announcement.id, {
      onSuccess: () => {
        setDeleteDialogOpen(false);
      },
    });
  };

  const handleDeleteAttachment = (attachmentId: string) => {
    deleteAttachment(attachmentId);
  };

  return (
    <>
      <div className="flex items-center gap-4 rounded-lg border p-4 hover:bg-accent/50 transition-colors">
        {/* 제목 및 정보 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 mb-2">
            <h3 className="font-semibold text-base truncate">{announcement.title}</h3>
            <span
              className={`
                inline-flex items-center rounded-full px-2 py-1 text-xs font-medium shrink-0
                ${announcement.is_active ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"}
              `}
            >
              {announcement.is_active ? "활성" : "비활성"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{announcement.created_by_profile?.full_name || announcement.created_by_profile?.email || "관리자"}</span>
            <span>•</span>
            <span>{formatDate(announcement.created_at)}</span>
            {announcement.expires_at && (
              <>
                <span>•</span>
                <span>종료: {formatDate(announcement.expires_at)}</span>
              </>
            )}
            {announcement.attachments && announcement.attachments.length > 0 && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <FileText className="size-3" />
                  {announcement.attachments.length}개 파일
                </span>
              </>
            )}
          </div>
          {announcement.content && (
            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{announcement.content}</p>
          )}
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center gap-2 shrink-0">
          <Switch
            checked={announcement.is_active}
            onCheckedChange={() => toggleActive(announcement.id)}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => onEdit?.(announcement.id)}
              >
                <Edit className="mr-2 size-4" />
                수정
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setDeleteDialogOpen(true)}
                className="text-destructive"
              >
                <Trash2 className="mr-2 size-4" />
                삭제
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>공지사항 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 "{announcement.title}" 공지사항을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
