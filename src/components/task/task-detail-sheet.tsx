import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { TaskStatusBadge } from "@/components/common/task-status-badge";
import type { TaskWithProfiles } from "@/api/task";

interface TaskDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskWithProfiles;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  REVIEW: "검토",
  REVISION: "수정",
  CONTRACT: "계약",
  SPECIFICATION: "명세서",
  APPLICATION: "출원",
};

/**
 * Task 상세 정보 Sheet 컴포넌트
 * 모바일: 하단에서 올라오는 드로어
 * 데스크톱: 오른쪽에서 슬라이드되는 패널
 */
export function TaskDetailSheet({
  open,
  onOpenChange,
  task,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: TaskDetailSheetProps) {
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[400px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>상세 정보</SheetTitle>
        </SheetHeader>

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

          {/* 액션 버튼 */}
          {(canEdit || canDelete) && (
            <>
              <Separator />
              <div className="space-y-2">
                {canEdit && (
                  <Button
                    variant="outline"
                    className="w-full justify-start"
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
                    className="w-full justify-start"
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
      </SheetContent>
    </Sheet>
  );
}
