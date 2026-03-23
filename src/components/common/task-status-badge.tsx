import type { Task } from "@/api/task";
import {
  FileText,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskStatusBadgeProps {
  status: Task["task_status"];
}

/**
 * Task 상태 배지 컴포넌트 (아이콘 + 텍스트)
 */
export function TaskStatusBadge({ status }: TaskStatusBadgeProps) {
  const statusConfig: Record<
    Task["task_status"],
    {
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      iconColor: string;
      hasOpacity?: boolean;
    }
  > = {
    ASSIGNED: {
      label: "할당됨",
      icon: FileText,
      iconColor: "", // 텍스트 색상과 동일 (기본 색상)
    },
    IN_PROGRESS: {
      label: "진행 중",
      icon: Loader2,
      iconColor: "text-yellow-500",
    },
    WAITING_CONFIRM: {
      label: "확인 대기",
      icon: Clock,
      iconColor: "text-red-500",
    },
    APPROVED: {
      label: "승인됨",
      icon: CheckCircle2,
      iconColor: "text-green-500",
    },
    REJECTED: {
      label: "거부됨",
      icon: XCircle,
      iconColor: "text-red-500",
      hasOpacity: true, // 텍스트 + 아이콘 모두 opacity/50
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={cn(
      "flex items-center gap-1.5 text-xs sm:text-sm",
      config.hasOpacity && "opacity-50"
    )}>
      <Icon className={cn("size-3 sm:size-4", config.iconColor)} />
      <span>{config.label}</span>
    </div>
  );
}
