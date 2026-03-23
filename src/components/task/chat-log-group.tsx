import { ChevronDown, ChevronRight, FileText, MessageSquare, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatLogWithItems, MessageWithProfile } from "@/api/message";

interface ChatLogGroupProps {
  log: ChatLogWithItems;
  isExpanded: boolean;
  onToggle: () => void;
  renderMessage: (message: MessageWithProfile) => React.ReactNode;
}

const LOG_TYPE_LABELS: Record<string, string> = {
  START: "시작",
  REQUEST_CONFIRM: "확인 요청",
  APPROVE: "승인",
  REJECT: "거부",
};

export function ChatLogGroup({
  log,
  isExpanded,
  onToggle,
  renderMessage,
}: ChatLogGroupProps) {
  const fileCount = log.items.filter((item) => item.message.message_type === "FILE").length;
  const textCount = log.items.filter((item) => item.message.message_type === "USER").length;

  const formatLogTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // 파일 업로드 기반 로그는 title에 파일명이 있음
  // 상태 변경 기반 로그는 title이 null이므로 기존 방식 사용
  const logTitle = log.title 
    ? log.title 
    : `${LOG_TYPE_LABELS[log.log_type] || log.log_type} 이전 대화`;

  return (
    <div className="min-w-0 space-y-2 mb-3 sm:mb-4">
      {/* 로그 헤더 (드롭다운 트리거) */}
      <div
        className={cn(
          "flex min-w-0 items-center justify-between p-2.5 sm:p-3 rounded-lg border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors",
          isExpanded && "border-primary/30 bg-primary/5"
        )}
        onClick={onToggle}
      >
        <div className="flex items-center gap-2 sm:gap-3 overflow-hidden flex-1 min-w-0">
          <div className="shrink-0 text-muted-foreground">
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>

          <div className="flex flex-col min-w-0 flex-1">
            <h4 className="text-xs sm:text-sm font-semibold truncate">
              {logTitle} 기록
            </h4>
            <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 flex-wrap">
              <span className="flex items-center gap-0.5 sm:gap-1">
                <FileText className="h-3 w-3" /> {fileCount}
              </span>
              <span className="flex items-center gap-0.5 sm:gap-1">
                <MessageSquare className="h-3 w-3" /> {textCount}
              </span>
              <span className="flex items-center gap-0.5 sm:gap-1 border-l pl-2 hidden sm:flex">
                <Clock className="h-3 w-3" /> {formatLogTime(log.created_at)}
              </span>
            </div>
          </div>
        </div>

        {!isExpanded && log.items.length > 0 && (
          <div className="flex -space-x-1.5 sm:-space-x-2 overflow-hidden ml-2 shrink-0">
            {log.items.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="flex h-5 w-5 sm:h-6 sm:w-6 rounded-full ring-2 ring-background bg-muted items-center justify-center text-[9px] sm:text-[10px] font-bold"
                title={item.message.sender?.full_name || item.message.sender?.email}
              >
                {(item.message.sender?.full_name || "U").charAt(0)}
              </div>
            ))}
            {log.items.length > 3 && (
              <div className="flex h-5 w-5 sm:h-6 sm:w-6 rounded-full ring-2 ring-background bg-muted items-center justify-center text-[9px] sm:text-[10px] text-muted-foreground">
                +{log.items.length - 3}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 로그 내용 (메시지 리스트) */}
      {isExpanded && (
        <div className="pl-3 sm:pl-4 border-l-2 border-muted ml-4 sm:ml-5 space-y-3 sm:space-y-4 py-2 animate-in fade-in slide-in-from-top-1 duration-200">
          {log.items.length === 0 ? (
            <div className="text-center py-3 sm:py-4 text-xs sm:text-sm text-muted-foreground italic">
              아무 내용도 존재하지 않음
            </div>
          ) : (
            log.items.map((item) => renderMessage(item.message))
          )}
        </div>
      )}
    </div>
  );
}
