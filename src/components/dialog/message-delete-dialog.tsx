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
import type { MessageWithProfile } from "@/api/message";

interface MessageDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: MessageWithProfile | null;
  onConfirm: () => Promise<void>;
  isLoading?: boolean;
}

/**
 * 메시지 삭제 확인 다이얼로그
 */
export function MessageDeleteDialog({
  open,
  onOpenChange,
  message,
  onConfirm,
  isLoading = false,
}: MessageDeleteDialogProps) {
  const handleConfirm = async () => {
    await onConfirm();
    onOpenChange(false);
  };

  const isFileMessage = message?.message_type === "FILE";
  const messagePreview = isFileMessage
    ? message.file_name || "파일"
    : message?.content?.substring(0, 50) || "메시지";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>메시지 삭제</AlertDialogTitle>
          <AlertDialogDescription>
            정말로 이 {isFileMessage ? "파일" : "메시지"}를 삭제하시겠습니까?
            <br />
            {isFileMessage ? (
              <>
                파일명:{" "}
                <strong className="break-all" style={{ wordBreak: "break-all", overflowWrap: "break-word" }}>
                  {messagePreview}
                </strong>
              </>
            ) : (
              <>
                메시지:{" "}
                <strong className="break-words" style={{ wordBreak: "break-word", overflowWrap: "break-word" }}>
                  {messagePreview}
                  {message?.content && message.content.length > 50 ? "..." : ""}
                </strong>
              </>
            )}
            <br />
            <span className="text-xs text-muted-foreground mt-2 block">
              삭제된 메시지는 채팅에서 사라지지만, 필요 시 복구할 수 있습니다.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>취소</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? "삭제 중..." : "삭제"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}


