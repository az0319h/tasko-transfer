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
import { AlertTriangle } from "lucide-react";
import type { TaskStatus } from "@/lib/task-status";

interface TaskForceApproveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentStatus: TaskStatus;
  taskTitle?: string;
  onConfirm: () => Promise<void>;
  isLoading?: boolean;
}

/**
 * Task 강제 승인 확인 다이얼로그
 */
export function TaskForceApproveDialog({
  open,
  onOpenChange,
  currentStatus,
  taskTitle,
  onConfirm,
  isLoading = false,
}: TaskForceApproveDialogProps) {
  const taskName = taskTitle ? `"${taskTitle}"` : "이 업무";

  const handleConfirm = async () => {
    await onConfirm();
    onOpenChange(false);
  };

  // 상태 한글명 매핑
  const statusMap: Record<TaskStatus, string> = {
    ASSIGNED: "할당됨",
    IN_PROGRESS: "진행 중",
    WAITING_CONFIRM: "확인 대기",
    APPROVED: "승인됨",
    REJECTED: "반려됨",
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            강제 승인
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2 pt-2">
            <div>
              <span className="font-medium">현재 상태:</span> {statusMap[currentStatus]}
            </div>
            <div>
              <span className="font-medium">목표 상태:</span> 승인됨
            </div>
            <div className="pt-2 text-destructive">
              모든 상태 변경 로직을 건너뛰고 강제로 승인 처리합니다.
              <br />
              이 작업은 되돌릴 수 없습니다.
            </div>
            <div className="pt-1">
              {taskName} 업무를 강제로 승인하시겠습니까?
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>취소</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? "처리 중..." : "강제 승인"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
