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
import type { TaskStatus } from "@/lib/task-status";

interface TaskStatusChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentStatus: TaskStatus;
  newStatus: TaskStatus;
  taskTitle?: string;
  onConfirm: () => Promise<void>;
  isLoading?: boolean;
}

/**
 * 상태별 확인 메시지 매핑
 */
function getStatusChangeMessage(
  currentStatus: TaskStatus,
  newStatus: TaskStatus,
  taskTitle?: string,
): { title: string; description: string } {
  const taskName = taskTitle ? `"${taskTitle}"` : "이 업무";

  if (currentStatus === "ASSIGNED" && newStatus === "IN_PROGRESS") {
    return {
      title: "업무 시작",
      description: `${taskName} 업무를 시작하시겠습니까?`,
    };
  }

  if (currentStatus === "IN_PROGRESS" && newStatus === "WAITING_CONFIRM") {
    return {
      title: "업무 완료 요청",
      description: `${taskName} 업무 완료를 요청하시겠습니까?`,
    };
  }

  if (currentStatus === "WAITING_CONFIRM" && newStatus === "APPROVED") {
    return {
      title: "업무 승인",
      description: `${taskName} 업무를 승인하시겠습니까?`,
    };
  }

  if (currentStatus === "WAITING_CONFIRM" && newStatus === "REJECTED") {
    return {
      title: "업무 반려",
      description: `${taskName} 업무를 반려하시겠습니까?`,
    };
  }

  if (currentStatus === "REJECTED" && newStatus === "IN_PROGRESS") {
    return {
      title: "업무 재진행",
      description: `${taskName} 업무를 다시 진행하시겠습니까?`,
    };
  }

  // 기본 메시지 (발생하지 않아야 함)
  return {
    title: "상태 변경",
    description: `상태를 변경하시겠습니까?`,
  };
}

/**
 * Task 상태 변경 확인 다이얼로그
 */
export function TaskStatusChangeDialog({
  open,
  onOpenChange,
  currentStatus,
  newStatus,
  taskTitle,
  onConfirm,
  isLoading = false,
}: TaskStatusChangeDialogProps) {
  const { title, description } = getStatusChangeMessage(
    currentStatus,
    newStatus,
    taskTitle,
  );

  const handleConfirm = async () => {
    await onConfirm();
    onOpenChange(false);
  };

  // 반려(REJECTED)인 경우 destructive 스타일 적용
  const isRejectAction = currentStatus === "WAITING_CONFIRM" && newStatus === "REJECTED";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>취소</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
            className={
              isRejectAction
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : ""
            }
          >
            {isLoading ? "처리 중..." : "확인"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}


