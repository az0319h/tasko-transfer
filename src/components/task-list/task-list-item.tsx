import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { TaskStatusBadge } from "@/components/common/task-status-badge";
import type { TaskWithProfiles } from "@/api/task";
import { cn } from "@/lib/utils";

interface TaskListItemProps {
  task: TaskWithProfiles;
  onRemove?: (taskId: string) => void;
  showRemoveButton?: boolean;
}

/**
 * Task 목록 항목 컴포넌트
 * 목록 상세 페이지에서 사용
 */
export function TaskListItem({
  task,
  onRemove,
  showRemoveButton = true,
}: TaskListItemProps) {
  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onRemove?.(task.id);
  };

  // 담당자 표시 형식
  const assigneeDisplay = task.assignee?.full_name
    ? `${task.assignee.full_name} (${task.assignee.email})`
    : task.assignee?.email || task.assignee_id;

  // 지시자 표시 형식
  const assignerDisplay = task.assigner?.full_name
    ? `${task.assigner.full_name} (${task.assigner.email})`
    : task.assigner?.email || task.assigner_id;

  // 마감일 포맷
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // 날짜 차이 계산 (일수)
  const calculateDaysDifference = (
    dueDateString: string | null | undefined,
  ): number | null => {
    if (!dueDateString) return null;
    const dueDate = new Date(dueDateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const dueDate = formatDate(task.due_date);
  const daysDiff = calculateDaysDifference(task.due_date);
  let dDayText = "";
  let dueDateColorClass = "text-muted-foreground";

  if (daysDiff !== null) {
    if (daysDiff < 0) {
      dDayText = `(D+${Math.abs(daysDiff)})`;
      dueDateColorClass = "text-destructive";
    } else if (daysDiff === 0) {
      dDayText = "(D-Day)";
      dueDateColorClass = "text-destructive";
    } else if (daysDiff <= 3) {
      dDayText = `(D-${daysDiff})`;
      dueDateColorClass = "text-orange-500";
    } else {
      dDayText = `(D-${daysDiff})`;
    }
  }

  return (
    <Link to={`/tasks/${task.id}`} className="block">
      <div
        className={cn(
          "group relative flex items-start gap-3 rounded-lg border p-4 transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
        )}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-sm font-medium line-clamp-2 flex-1">{task.title}</h3>
            <TaskStatusBadge status={task.task_status} />
          </div>

          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <span className="font-medium">지시자:</span>
              <span className="line-clamp-1">{assignerDisplay}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-medium">담당자:</span>
              <span className="line-clamp-1">{assigneeDisplay}</span>
            </div>
            {dueDate && (
              <div className={cn("flex items-center gap-1", dueDateColorClass)}>
                <span className="font-medium">마감일:</span>
                <span>
                  {dueDate} {dDayText}
                </span>
              </div>
            )}
          </div>
        </div>

        {showRemoveButton && onRemove && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleRemove}
            title="목록에서 제거"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Link>
  );
}
