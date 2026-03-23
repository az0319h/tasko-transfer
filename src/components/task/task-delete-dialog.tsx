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
import { useTask } from "@/hooks";

interface TaskDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string | null;
  onConfirm: () => Promise<void>;
  isLoading?: boolean;
}

/**
 * Task 삭제 확인 다이얼로그
 */
export function TaskDeleteDialog({
  open,
  onOpenChange,
  taskId,
  onConfirm,
  isLoading = false,
}: TaskDeleteDialogProps) {
  const { data: task } = useTask(taskId || undefined);

  const handleConfirm = async () => {
    await onConfirm();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Task 삭제</AlertDialogTitle>
          <AlertDialogDescription>
            정말로 <strong>{task?.title}</strong> Task를 삭제하시겠습니까?
            <br />
            이 작업은 되돌릴 수 없으며, 관련된 모든 메시지도 함께 삭제됩니다.
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

