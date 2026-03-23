import { Link } from "react-router";
import { Play, CheckCircle, XCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskStatusBadge } from "@/components/common/task-status-badge";
import { canEditTask } from "@/lib/project-permissions";
import type { TaskWithProfiles } from "@/api/task";
import type { TaskStatus } from "@/lib/task-status";
import { cn } from "@/lib/utils";

interface TaskCardProps {
  task: TaskWithProfiles;
  projectTitle?: string; // 프로젝트명 (모달에서 사용)
  currentUserId?: string;
  isAdmin?: boolean;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  showActions?: boolean; // 상태 변경 버튼 표시 여부 (기본값: true)
  showFullInfo?: boolean; // 전체 정보 표시 여부 (기본값: true) - false일 경우 생성일만 숨김
}

/**
 * Task 카드 컴포넌트
 * 칸반 보드에서 사용되는 Task 카드
 */
export function TaskCard({
  task,
  projectTitle,
  currentUserId,
  isAdmin = false,
  onStatusChange,
  showActions = true,
  showFullInfo = true,
}: TaskCardProps) {
  
  // 담당자 표시 형식 (이름과 이메일)
  const assigneeDisplay = task.assignee?.full_name 
    ? `${task.assignee.full_name} (${task.assignee.email})`
    : task.assignee?.email || task.assignee_id;
  
  // 지시자 표시 형식 (이름과 이메일)
  const assignerDisplay = task.assigner?.full_name 
    ? `${task.assigner.full_name} (${task.assigner.email})`
    : task.assigner?.email || task.assigner_id;

  // 현재 사용자가 assigner인지 assignee인지 확인
  const isAssigner = currentUserId === task.assigner_id;
  const isAssignee = currentUserId === task.assignee_id;

  // 상태 변경 버튼 표시 조건
  const canChangeToInProgress = isAssignee && (task.task_status === "ASSIGNED" || task.task_status === "REJECTED");
  const canChangeToWaitingConfirm = isAssignee && task.task_status === "IN_PROGRESS";
  const canApprove = isAssigner && task.task_status === "WAITING_CONFIRM";
  const canReject = isAssigner && task.task_status === "WAITING_CONFIRM";

  // 마감일 포맷 및 D-Day 계산
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
    });
  };

  // 날짜 차이 계산 (일수)
  const calculateDaysDifference = (dueDateString: string | null | undefined): number | null => {
    if (!dueDateString) return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dueDate = new Date(dueDateString);
    dueDate.setHours(0, 0, 0, 0);
    
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  // D-Day 표시 텍스트 생성
  const getDDayText = (daysDiff: number | null): string => {
    if (daysDiff === null) return "";
    
    if (daysDiff > 0) {
      return `(D-${daysDiff})`;
    } else if (daysDiff === 0) {
      return "(D-Day)";
    } else {
      return `(D+${Math.abs(daysDiff)})`;
    }
  };

  // 마감일 색상 클래스 결정
  const getDueDateColorClass = (daysDiff: number | null, taskStatus: TaskStatus): string => {
    if (daysDiff === null) return "text-muted-foreground";
    
    // 이미 승인된 Task는 기본 색상
    if (taskStatus === "APPROVED") {
      return "text-muted-foreground";
    }
    
    if (daysDiff === 0) {
      // D-Day: 빨간색
      return "text-destructive font-semibold";
    } else if (daysDiff === 1) {
      // D-1: 주황색
      return "text-orange-600 dark:text-orange-500 font-medium";
    } else if (daysDiff >= 2 && daysDiff <= 7) {
      // D-2 ~ D-7: 파란색
      return "text-blue-600 dark:text-blue-500 font-medium";
    } else if (daysDiff < 0) {
      // D+1 이상 (마감일 지남, 승인 안됨): 빨간색 (D-Day와 동일)
      return "text-destructive font-semibold";
    } else {
      // D-8 이상: 회색
      return "text-muted-foreground";
    }
  };

  const dueDate = formatDate(task.due_date);
  const daysDiff = calculateDaysDifference(task.due_date);
  const dDayText = getDDayText(daysDiff);
  const dueDateColorClass = getDueDateColorClass(daysDiff, task.task_status);
  const createdAt = formatDate(task.created_at);

  return (
    <Link to={`/tasks/${task.id}`} className="block">
      <Card className="hover:shadow-md transition-shadow cursor-pointer group">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm font-medium line-clamp-2 flex-1">
              {task.title}
            </CardTitle>
            <TaskStatusBadge status={task.task_status} />
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {/* 프로젝트명 - projectTitle이 있을 때만 표시 */}
          {projectTitle && (
            <div className="text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <span className="font-medium">프로젝트:</span>
                <span className="line-clamp-1">{projectTitle}</span>
              </div>
            </div>
          )}

          {/* 지시자 정보 */}
          <div className="text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <span className="font-medium">지시자:</span>
              <span>{assignerDisplay}</span>
            </div>
          </div>

          {/* 담당자 정보 */}
          <div className="text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <span className="font-medium">담당자:</span>
              <span>{assigneeDisplay}</span>
            </div>
          </div>

          {/* 참조자 정보 */}
          {task.references && task.references.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span className="font-medium">참조자:</span>
                <span>{task.references.length}명</span>
              </div>
            </div>
          )}

          {/* 생성일 - showFullInfo가 true일 때만 표시 */}
          {showFullInfo && createdAt && (
            <div className="text-xs text-muted-foreground">
              생성일: {createdAt}
            </div>
          )}

          {/* 마감일 */}
          {dueDate && (
            <div className={cn("text-xs", dueDateColorClass)}>
              마감일: {dueDate} {dDayText}
            </div>
          )}

          {/* 액션 버튼들 */}
          {showActions && (
            <div className="flex flex-wrap gap-1 pt-2 border-t">
              {/* 상태 변경 버튼 */}
              {canChangeToInProgress && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs flex-1"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onStatusChange?.(task.id, "IN_PROGRESS");
                  }}
                >
                  <Play className="mr-1 h-3 w-3" />
                  시작
                </Button>
              )}
              {canChangeToWaitingConfirm && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs flex-1"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onStatusChange?.(task.id, "WAITING_CONFIRM");
                  }}
                >
                  확인 요청
                </Button>
              )}
              {canApprove && (
                <Button
                  variant="default"
                  size="sm"
                  className="h-7 text-xs flex-1"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onStatusChange?.(task.id, "APPROVED");
                  }}
                >
                  <CheckCircle className="mr-1 h-3 w-3" />
                  승인
                </Button>
              )}
              {canReject && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7 text-xs flex-1"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onStatusChange?.(task.id, "REJECTED");
                  }}
                >
                  <XCircle className="mr-1 h-3 w-3" />
                  거부
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

