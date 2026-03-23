import { useState, useMemo, useEffect } from "react";
import { SEO } from "@/components/common/seo";
import { useNotifications, useUnreadNotificationCount } from "@/hooks/queries/use-notifications";
import { useMarkNotificationAsRead, useMarkAllNotificationsAsRead, useDeleteNotification } from "@/hooks/mutations/use-notification";
import { useRealtimeNotifications } from "@/hooks/queries/use-realtime-notifications";
import { TaskStatusBadge } from "@/components/common/task-status-badge";
import { Button } from "@/components/ui/button";
import DefaultSpinner from "@/components/common/default-spinner";
import { TablePagination } from "@/components/common/table-pagination";
import { Bell, CheckCircle2, Circle, Trash2, CheckCheck } from "lucide-react";
import { useNavigate } from "react-router";
import type { NotificationWithTask } from "@/api/notification";
import type { TaskStatus } from "@/lib/task-status";
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
import { cn } from "@/lib/utils";

/**
 * 날짜 포맷팅 (26.01.30 오후04:01 형식)
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "오후" : "오전";
  const displayHours = hours % 12 || 12;
  const formattedHours = displayHours.toString().padStart(2, "0");

  return `${year}.${month}.${day} ${ampm}${formattedHours}:${minutes}`;
}

/**
 * 알림 메시지에서 특정 단어에 빨간색 적용
 * "오늘"과 "초과" 단어를 빨간색으로 표시
 */
function highlightKeywords(text: string): React.ReactNode {
  if (!text) return text;

  const keywords = ["오늘", "초과"];
  const parts: Array<{ text: string; isKeyword: boolean }> = [];
  let lastIndex = 0;

  // 모든 키워드의 위치 찾기
  const matches: Array<{ index: number; keyword: string; length: number }> = [];
  keywords.forEach((keyword) => {
    let index = text.indexOf(keyword, 0);
    while (index !== -1) {
      matches.push({ index, keyword, length: keyword.length });
      index = text.indexOf(keyword, index + 1);
    }
  });

  // 인덱스 순으로 정렬
  matches.sort((a, b) => a.index - b.index);

  // 겹치는 부분 처리 (겹치지 않도록)
  const nonOverlappingMatches: Array<{ index: number; keyword: string; length: number }> = [];
  matches.forEach((match) => {
    const overlaps = nonOverlappingMatches.some(
      (existing) =>
        match.index < existing.index + existing.length &&
        match.index + match.length > existing.index
    );
    if (!overlaps) {
      nonOverlappingMatches.push(match);
    }
  });

  // 정렬
  nonOverlappingMatches.sort((a, b) => a.index - b.index);

  // 텍스트 분할
  nonOverlappingMatches.forEach((match) => {
    if (match.index > lastIndex) {
      parts.push({ text: text.substring(lastIndex, match.index), isKeyword: false });
    }
    parts.push({ text: text.substring(match.index, match.index + match.length), isKeyword: true });
    lastIndex = match.index + match.length;
  });

  if (lastIndex < text.length) {
    parts.push({ text: text.substring(lastIndex), isKeyword: false });
  }

  // 매칭이 없으면 원본 텍스트 반환
  if (parts.length === 0) {
    return text;
  }

  // React 노드로 변환
  return (
    <>
      {parts.map((part, index) =>
        part.isKeyword ? (
          <span key={index} className="text-red-600 dark:text-red-500 font-semibold">
            {part.text}
          </span>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </>
  );
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    const saved = sessionStorage.getItem("notificationPageSize");
    return saved ? parseInt(saved, 10) : 20;
  });

  // Realtime 구독 활성화
  useRealtimeNotifications(true);

  // 알림 목록 조회 (모든 알림을 한번에 가져옴)
  const { data: allNotifications, isLoading } = useNotifications({});

  // 읽지 않은 알림 수 조회
  const { data: unreadCount } = useUnreadNotificationCount();

  // 전체 읽음 처리
  const markAllAsRead = useMarkAllNotificationsAsRead();
  const markAsRead = useMarkNotificationAsRead();
  const deleteNotification = useDeleteNotification();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<string | null>(null);

  // 필터링된 알림 목록
  const filteredNotifications = useMemo(() => {
    if (!allNotifications) return [];

    let filtered = [...allNotifications];

    // 필터 적용
    if (filter === "unread") {
      filtered = filtered.filter((n) => !n.is_read);
    } else if (filter === "read") {
      filtered = filtered.filter((n) => n.is_read);
    }

    return filtered;
  }, [allNotifications, filter]);

  // 필터별 개수 계산
  const filterCounts = useMemo(() => {
    if (!allNotifications) {
      return { all: 0, unread: 0, read: 0 };
    }
    const unread = allNotifications.filter((n) => !n.is_read).length;
    const read = allNotifications.filter((n) => n.is_read).length;
    return {
      all: allNotifications.length,
      unread,
      read,
    };
  }, [allNotifications]);

  // 페이지네이션 적용
  const paginatedNotifications = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredNotifications.slice(startIndex, endIndex);
  }, [filteredNotifications, currentPage, pageSize]);

  const totalItems = filteredNotifications.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  // 필터 변경 시 1페이지로 리셋
  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  // 페이지 크기 변경 시 sessionStorage에 저장
  useEffect(() => {
    sessionStorage.setItem("notificationPageSize", pageSize.toString());
  }, [pageSize]);

  const handleMarkAllAsRead = () => {
    if (unreadCount && unreadCount > 0) {
      markAllAsRead.mutate();
    }
  };

  // 상태 버튼 클릭 (읽음 처리만)
  const handleStatusClick = (e: React.MouseEvent, notification: NotificationWithTask) => {
    e.stopPropagation();
    if (!notification.is_read) {
      markAsRead.mutate(notification.id);
    }
  };

  // Row 클릭 (task_id로 이동, 읽음 처리 없음)
  const handleRowClick = (notification: NotificationWithTask) => {
    if (notification.task_id) {
      const currentUrl = window.location.pathname + window.location.search;
      sessionStorage.setItem("previousDashboardUrl", currentUrl);
      navigate(`/tasks/${notification.task_id}`);
    }
  };

  const handleDelete = (notificationId: string) => {
    deleteNotification.mutate(notificationId);
    setDeleteDialogOpen(null);
  };

  return (
    <>
      <div className="lg:p-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold mb-2">알림</h1>
            {unreadCount !== undefined && unreadCount > 0 ? (
              <p className="text-sm text-muted-foreground">
                읽지 않은 알림 {unreadCount}개
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Tasko의 모든 알림을 확인할 수 있습니다.
              </p>
            )}
          </div>
          {unreadCount !== undefined && unreadCount > 0 && (
            <Button onClick={handleMarkAllAsRead} className="h-9">
              <CheckCheck className="mr-2 h-4 w-4" />
              모두 읽음 처리
            </Button>
          )}
        </div>

        {/* 필터 */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
            className="p-1 sm:p-1.5"
          >
            전체 ({filterCounts.all}개)
          </Button>
          <Button
            variant={filter === "unread" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("unread")}
            className="p-1 sm:p-1.5"
          >
            읽지 않음 ({filterCounts.unread}개)
          </Button>
          <Button
            variant={filter === "read" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("read")}
            className="p-1 sm:p-1.5"
          >
            읽음 ({filterCounts.read}개)
          </Button>
        </div>

        {/* 알림 테이블 */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <DefaultSpinner />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Bell className="size-12 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold mb-2">
              {filter === "unread" ? "읽지 않은 알림이 없습니다" : filter === "read" ? "읽은 알림이 없습니다" : "알림이 없습니다"}
            </p>
            <p className="text-sm text-muted-foreground">
              새로운 알림이 오면 여기에 표시됩니다.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-scroll">
              <table className="w-full min-w-[1100px] table-fixed">
                <thead>
                  <tr className="border-b">
                    <th className="w-[6%] px-2 py-3 text-center text-xs font-medium sm:px-4 sm:text-sm">
                      상태
                    </th>
                    <th className="w-[10%] px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm">
                      상태
                    </th>
                    <th className="w-[22%] px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm">
                      제목/메시지
                    </th>
                    <th className="w-[10%] px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm">
                      계정 ID
                    </th>
                    <th className="w-[12%] px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm">
                      고객명
                    </th>
                    <th className="w-[18%] px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm">
                      지시사항
                    </th>
                    <th className="w-[10%] px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm">
                      날짜
                    </th>
                    <th className="w-[12%] px-2 py-3 text-center text-xs font-medium sm:px-4 sm:text-sm">
                      작업
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedNotifications.map((notification) => {
                    // 제목/메시지 통합 (제목 우선, 없으면 메시지)
                    const titleOrMessage = notification.title || notification.message || "-";
                    const clientName = notification.task?.client_name || "-";
                    const taskTitle = notification.task?.title || "-";
                    const taskStatus = notification.task?.task_status;

                    return (
                      <tr
                        key={notification.id}
                        className={cn(
                          "hover:bg-muted/50 border-b transition-colors cursor-pointer",
                          !notification.is_read && "bg-blue-50/50 dark:bg-blue-950/20"
                        )}
                        onClick={() => handleRowClick(notification)}
                      >
                        {/* 상태 (버튼 아이콘 - 읽음 처리용) */}
                        <td className="px-2 py-3 text-center sm:px-4 sm:py-4">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => handleStatusClick(e, notification)}
                          >
                            {notification.is_read ? (
                              <CheckCircle2 className="size-5 text-muted-foreground" />
                            ) : (
                              <Circle className="size-5 text-blue-500 fill-blue-500" />
                            )}
                          </Button>
                        </td>

                        {/* 상태 (TaskStatusBadge) */}
                        <td className="px-2 py-3 sm:px-4 sm:py-4">
                          {taskStatus ? (
                            <TaskStatusBadge status={taskStatus as TaskStatus} />
                          ) : (
                            <span className="text-xs sm:text-sm text-muted-foreground">-</span>
                          )}
                        </td>

                        {/* 제목/메시지 (통합) */}
                        <td className="px-2 py-3 sm:px-4 sm:py-4">
                          <div className={cn(
                            "line-clamp-2 text-xs sm:text-sm",
                            !notification.is_read && "font-semibold"
                          )}>
                            {highlightKeywords(titleOrMessage)}
                          </div>
                        </td>

                        {/* 계정 ID */}
                        <td className="px-2 py-3 sm:px-4 sm:py-4">
                          <div className="line-clamp-2 text-xs sm:text-sm">
                            {notification.task?.id ? (
                              <span className="font-mono text-xs">{notification.task.id.slice(0, 8).toUpperCase()}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </td>

                        {/* 고객명 */}
                        <td className="px-2 py-3 sm:px-4 sm:py-4">
                          <div className="line-clamp-2 text-xs sm:text-sm">
                            {clientName}
                          </div>
                        </td>

                        {/* 지시사항 */}
                        <td className="px-2 py-3 sm:px-4 sm:py-4">
                          <div className="line-clamp-2 text-xs sm:text-sm">
                            {taskTitle}
                          </div>
                        </td>

                        {/* 날짜 */}
                        <td className="px-2 py-3 sm:px-4 sm:py-4">
                          <div className="line-clamp-2 text-xs sm:text-sm text-muted-foreground">
                            {formatDate(notification.created_at)}
                          </div>
                        </td>

                        {/* 삭제 버튼 */}
                        <td className="px-2 py-3 text-center sm:px-4 sm:py-4">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteDialogOpen(notification.id);
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 페이지네이션 */}
            {totalItems > 0 && (
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={totalItems}
                selectedCount={0}
                onPageChange={setCurrentPage}
                onPageSizeChange={(newPageSize) => {
                  setPageSize(newPageSize);
                  setCurrentPage(1);
                }}
              />
            )}
          </>
        )}
      </div>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteDialogOpen !== null} onOpenChange={(open) => !open && setDeleteDialogOpen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>알림 삭제</AlertDialogTitle>
            <AlertDialogDescription>이 알림을 삭제하시겠습니까?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteDialogOpen && handleDelete(deleteDialogOpen)}>
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
