import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { TaskStatusBadge } from "@/components/common/task-status-badge";
import type { TaskWithProfiles } from "@/api/task";

interface TaskDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskWithProfiles;
  canEdit: boolean;
  canDelete: boolean;
  currentUserId?: string;
  onEdit: () => void;
  onDelete: () => void;
  onSendEmailToClientChange?: (checked: boolean) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  REVIEW: "검토",
  REVISION: "수정",
  CONTRACT: "계약",
  SPECIFICATION: "명세서",
  APPLICATION: "출원",
};

/**
 * Task 상세 정보 Dialog 컴포넌트
 * 모달 형태로 Task 상세 정보를 표시
 */
export function TaskDetailDialog({
  open,
  onOpenChange,
  task,
  canEdit,
  canDelete,
  currentUserId,
  onEdit,
  onDelete,
  onSendEmailToClientChange,
}: TaskDetailDialogProps) {
  // 담당자(assignee)인지 확인
  const isAssignee = currentUserId === task.assignee_id;
  // 참조자인지 확인
  const isReference = task.references?.some((ref) => ref.id === currentUserId) ?? false;
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "미정";
    return new Date(dateString).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDueDate = (dateString: string | null) => {
    if (!dateString) return "미정";
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(date);
    dueDate.setHours(0, 0, 0, 0);
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let dDayText = "";
    if (diffDays > 0) {
      dDayText = ` (D-${diffDays})`;
    } else if (diffDays === 0) {
      dDayText = " (D-Day)";
    } else {
      dDayText = ` (D+${Math.abs(diffDays)})`;
    }

    return formatDate(dateString) + dDayText;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>상세 정보</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 고유 ID */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">고유 ID</h3>
            <p className="text-base font-medium font-mono">{task.id.substring(0, 8).toUpperCase()}</p>
          </div>

          {/* 고객명 */}
          {task.client_name && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">고객명</h3>
              <p className="text-base font-medium">{task.client_name}</p>
            </div>
          )}

          {/* 지시자 */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">지시자</h3>
            <p className="text-base font-medium">
              {task.assigner?.full_name || task.assigner?.email || task.assigner_id}
              {task.assigner?.email && task.assigner?.full_name && (
                <span className="text-muted-foreground ml-2 text-sm">
                  ({task.assigner.email})
                </span>
              )}
            </p>
          </div>

          {/* 담당자 */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">담당자</h3>
            <p className="text-base font-medium">
              {task.assignee?.full_name || task.assignee?.email || task.assignee_id}
              {task.assignee?.email && task.assignee?.full_name && (
                <span className="text-muted-foreground ml-2 text-sm">
                  ({task.assignee.email})
                </span>
              )}
            </p>
          </div>

          {/* 참조자 */}
          {task.references && task.references.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">참조자</h3>
              <div className="space-y-1">
                {task.references.map((ref) => (
                  <p key={ref.id} className="text-base font-medium">
                    {ref.full_name || ref.email || ref.id}
                    {ref.email && ref.full_name && (
                      <span className="text-muted-foreground ml-2 text-sm">
                        ({ref.email})
                      </span>
                    )}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* 마감일 */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">마감일</h3>
            <p className="text-base font-medium">{formatDueDate(task.due_date)}</p>
          </div>

          {/* 생성일 */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">생성일</h3>
            <p className="text-base font-medium">{formatDate(task.created_at)}</p>
          </div>

          {/* 카테고리 */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">카테고리</h3>
            <p className="text-base font-medium">
              {CATEGORY_LABELS[task.task_category] || task.task_category}
            </p>
          </div>

          {/* 상태 */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">상태</h3>
            <TaskStatusBadge status={task.task_status} />
          </div>

          {/* 고객에게 이메일 발송 완료 토글 (승인 상태일 때만 표시, 담당자만 변경 가능) */}
          {task.task_status === "APPROVED" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="send-email-to-client" className="text-sm font-medium">
                  고객에게 이메일 발송 완료
                </Label>
                <Switch
                  id="send-email-to-client"
                  checked={task.send_email_to_client || false}
                  disabled={(!isAssignee && !isReference) || !onSendEmailToClientChange}
                  onCheckedChange={(checked) => {
                    if (onSendEmailToClientChange) {
                      onSendEmailToClientChange(checked);
                    }
                  }}
                />
              </div>
              {!isAssignee && !isReference && (
                <p className="text-xs text-muted-foreground">
                  담당자 또는 참조자만 변경할 수 있습니다.
                </p>
              )}
            </div>
          )}

          {/* 액션 버튼 */}
          {(canEdit || canDelete) && (
            <>
              <Separator />
              <div className="space-y-2">
                {canEdit && (
                  <Button
                    variant="outline"
                    className="w-full justify-center"
                    onClick={() => {
                      onEdit();
                      onOpenChange(false);
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    수정
                  </Button>
                )}
                {canDelete && (
                  <Button
                    variant="destructive"
                    className="w-full justify-center"
                    onClick={() => {
                      onDelete();
                      onOpenChange(false);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    삭제
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
