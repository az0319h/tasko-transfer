import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, FileText, MessageSquare, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/lib/task-status";
import type { MessageLogWithSystemMessage, MessageWithProfile } from "@/api/message";
import { Button } from "@/components/ui/button";

interface MessageGroupProps {
  log: MessageLogWithSystemMessage;
  messages: MessageWithProfile[];
  isExpanded: boolean;
  onToggle: () => void;
  renderMessage: (message: MessageWithProfile) => React.ReactNode;
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  ASSIGNED: "할당됨",
  IN_PROGRESS: "진행 중",
  WAITING_CONFIRM: "확인 대기",
  APPROVED: "승인됨",
  REJECTED: "거부됨",
};

export function MessageGroup({
  log,
  messages,
  isExpanded,
  onToggle,
  renderMessage,
}: MessageGroupProps) {
  // 로그에 해당하는 메시지들 필터링
  // 로그 박스는 상태 변경 이전의 메시지만 포함 (이전 SYSTEM 메시지 ~ 현재 SYSTEM 메시지, 현재 SYSTEM 메시지 제외)
  const filteredMessages = useMemo(() => {
    return messages.filter((msg) => {
      // SYSTEM 메시지는 제외 (그룹 사이에 따로 렌더링됨)
      if (msg.message_type === "SYSTEM") return false;

      const msgTime = new Date(msg.created_at).getTime();
      const logSystemMsgTime = new Date(log.system_message.created_at).getTime();
      
      // 첫 번째 로그 (이전 시스템 메시지가 없는 경우): Task 생성 ~ 첫 SYSTEM 메시지 (SYSTEM 메시지 제외)
      if (!log.previous_system_message) {
        return msgTime < logSystemMsgTime;
      }

      // 중간/마지막 로그: 이전 SYSTEM 메시지 ~ 현재 SYSTEM 메시지 (현재 SYSTEM 메시지 제외)
      // 부등호를 >= 로 변경하여 같은 시간에 생성된 메시지도 포함되도록 함
      const prevLogTime = new Date(log.previous_system_message.created_at).getTime();
      return msgTime >= prevLogTime && msgTime < logSystemMsgTime;
    });
  }, [messages, log]);

  const formatLogTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-2 mb-4">
      {/* 로그 헤더 (드롭다운 트리거) */}
      <div 
        className={cn(
          "flex items-center justify-between p-3 rounded-lg border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors",
          isExpanded && "border-primary/30 bg-primary/5"
        )}
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="shrink-0 text-muted-foreground">
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>
          
          <div className="flex flex-col min-w-0">
            <h4 className="text-sm font-semibold truncate">
              {log.title} 기록
            </h4>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" /> {log.file_count}
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" /> {log.text_count}
              </span>
              <span className="flex items-center gap-1 ml-1 border-l pl-2">
                <Clock className="h-3 w-3" /> {formatLogTime(log.created_at)}
              </span>
            </div>
          </div>
        </div>
        
        {!isExpanded && filteredMessages.length > 0 && (
          <div className="flex -space-x-2 overflow-hidden ml-2 shrink-0">
            {filteredMessages.slice(0, 3).map((msg, i) => (
              <div 
                key={msg.id} 
                className="flex h-6 w-6 rounded-full ring-2 ring-background bg-muted items-center justify-center text-[10px] font-bold"
                title={msg.sender?.full_name || msg.sender?.email}
              >
                {(msg.sender?.full_name || "U").charAt(0)}
              </div>
            ))}
            {filteredMessages.length > 3 && (
              <div className="flex h-6 w-6 rounded-full ring-2 ring-background bg-muted items-center justify-center text-[10px] text-muted-foreground">
                +{filteredMessages.length - 3}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 로그 내용 (메시지 리스트) */}
      {isExpanded && (
        <div className="pl-4 border-l-2 border-muted ml-5 space-y-4 py-2 animate-in fade-in slide-in-from-top-1 duration-200">
          {filteredMessages.length === 0 ? (
            <div className="text-center py-4 text-sm text-muted-foreground italic">
              아무 내용도 존재하지 않음
            </div>
          ) : (
            filteredMessages.map((msg) => renderMessage(msg))
          )}
        </div>
      )}
    </div>
  );
}
