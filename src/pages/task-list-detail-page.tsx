import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate, Link, useSearchParams } from "react-router";
import { SEO } from "@/components/common/seo";
import {
  useTaskList,
  useRemoveTaskFromList,
  useUpdateTaskList,
  useDeleteTaskList,
  useCurrentProfile,
  useUpdateTaskListItemsOrder,
} from "@/hooks";
import { TaskListFormDialog } from "@/components/task-list/task-list-form-dialog";
import { Button } from "@/components/ui/button";
import { TaskStatusBadge } from "@/components/common/task-status-badge";
import DefaultSpinner from "@/components/common/default-spinner";
import { TablePagination } from "@/components/common/table-pagination";
import { ArrowLeft, Pencil, Trash2, Bell, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
import type { TaskStatus } from "@/lib/task-status";
import { getUnreadMessageCounts } from "@/api/message";
import supabase from "@/lib/supabase";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type { Database } from "@/database.type";
import type { TaskWithProfiles } from "@/api/task";

type MessageRow = Database["public"]["Tables"]["messages"]["Row"];

/**
 * 마감일 포맷팅 (대시보드 로직 재사용)
 */
function formatDueDate(dateString: string | null | undefined): string | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  return date.toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });
}

/**
 * 날짜 차이 계산 (일수)
 */
function calculateDaysDifference(dueDateString: string | null | undefined): number | null {
  if (!dueDateString) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(dueDateString);
  dueDate.setHours(0, 0, 0, 0);

  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * D-Day 표시 텍스트 생성
 */
function getDDayText(daysDiff: number | null): string {
  if (daysDiff === null) return "";

  if (daysDiff > 0) {
    return `(D-${daysDiff})`;
  } else if (daysDiff === 0) {
    return "(D-Day)";
  } else {
    return `(D+${Math.abs(daysDiff)})`;
  }
}

/**
 * 마감일 색상 클래스 결정
 */
function getDueDateColorClass(daysDiff: number | null, taskStatus: TaskStatus): string {
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
}

/**
 * Sortable 테이블 행 컴포넌트
 */
interface SortableRowProps {
  item: {
    id: string;
    task_id: string;
    created_at: string;
    display_order: number;
    task: TaskWithProfiles;
  };
  unreadCount: number;
  onRemove: (taskId: string, e: React.MouseEvent) => void;
  isRemoving: boolean;
  navigate: (path: string) => void;
}

function SortableRow({ item, unreadCount, onRemove, isRemoving, navigate }: SortableRowProps) {
  const task = item.task;
  const dueDate = formatDueDate(task.due_date);
  const daysDiff = calculateDaysDifference(task.due_date);
  const dDayText = getDDayText(daysDiff);
  const dueDateColorClass = getDueDateColorClass(daysDiff, task.task_status);

  const assignerName = task.assigner?.full_name || task.assigner?.email?.split('@')[0] || '-';
  const assigneeName = task.assignee?.full_name || task.assignee?.email?.split('@')[0] || '-';
  const assignerAssigneeDisplay = `${assignerName} / ${assigneeName}`;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(
        "hover:bg-muted/50 border-b transition-colors cursor-pointer",
        isDragging && "bg-muted"
      )}
      onClick={() => {
        navigate(`/tasks/${task.id}`);
      }}
    >
      {/* 드래그 핸들 컬럼 */}
      <td className="px-2 py-3 sm:px-4 sm:py-4 w-[8%]">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </div>
      </td>
      <td className="px-2 py-3 sm:px-4 sm:py-4">
        <div className="line-clamp-2 text-xs sm:text-sm">
          {task.id ? (
            <span className="font-mono text-xs">{task.id.slice(0, 8).toUpperCase()}</span>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      </td>
      <td className="px-2 py-3 sm:px-4 sm:py-4">
        <div className="line-clamp-2 text-xs sm:text-sm">
          {task.client_name || (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      </td>
      <td className="px-2 py-3 sm:px-4 sm:py-4">
        <div className="line-clamp-2 text-xs sm:text-sm">
          <Link
            to={`/tasks/${task.id}`}
            className="line-clamp-2 hover:underline cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            {task.title}
          </Link>
        </div>
      </td>
      <td className="px-2 py-3 sm:px-4 sm:py-4">
        {dueDate ? (
          <span
            className={cn(
              "text-xs whitespace-nowrap sm:text-sm",
              dueDateColorClass,
            )}
          >
            {dueDate} {dDayText}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs sm:text-sm">-</span>
        )}
      </td>
      <td className="px-2 py-3 sm:px-4 sm:py-4">
        <TaskStatusBadge status={task.task_status} />
      </td>
      <td className="px-2 py-3 text-center sm:px-4 sm:py-4">
        {unreadCount > 0 ? (
          <div className="relative inline-flex">
            <Bell className="h-6 w-6" style={{ fill: "oklch(0.637 0.237 25.331)", color: "oklch(0.637 0.237 25.331)" }} />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-semibold text-white">
              {unreadCount}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground text-xs sm:text-sm">-</span>
        )}
      </td>
      <td className="px-2 py-3 sm:px-4 sm:py-4">
        <div className="line-clamp-2 text-xs sm:text-sm">{assignerAssigneeDisplay}</div>
      </td>
      <td className="px-2 py-3 text-center sm:px-4 sm:py-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={(e) => onRemove(task.id, e)}
          disabled={isRemoving}
          title="목록에서 제거"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </td>
    </tr>
  );
}

/**
 * Task 목록 상세 페이지
 */
export default function TaskListDetailPage() {
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: taskList, isLoading, error } = useTaskList(listId);
  const { data: currentProfile } = useCurrentProfile();
  const updateTaskList = useUpdateTaskList();
  const deleteTaskList = useDeleteTaskList();
  const removeTaskFromList = useRemoveTaskFromList();
  const updateTaskListItemsOrder = useUpdateTaskListItemsOrder();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map());
  const channelsRef = useRef<Map<string, RealtimeChannel>>(new Map());
  
  // 드래그 앤 드롭 센서 설정
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 페이지네이션 상태 - URL 파라미터에서 읽기
  const pageParam = searchParams.get("page");
  const currentPage = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    const saved = sessionStorage.getItem("tablePageSize");
    return saved ? parseInt(saved, 10) : 10;
  });

  // URL 파라미터 업데이트 함수 (useCallback으로 메모이제이션)
  const updateUrlParams = useCallback((updates: { page?: number }) => {
    const newParams = new URLSearchParams(searchParams);
    
    if (updates.page !== undefined) {
      if (updates.page === 1) {
        newParams.delete("page");
      } else {
        newParams.set("page", updates.page.toString());
      }
    }
    
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  // 읽지 않은 메시지 수 조회 (useCallback으로 메모이제이션)
  const fetchUnreadCounts = useCallback(async () => {
    if (!taskList || !currentProfile?.id || taskList.items.length === 0) {
      setUnreadCounts(new Map());
      return;
    }

    const taskIds = taskList.items.map((item) => item.task.id);
    try {
      const counts = await getUnreadMessageCounts(taskIds, currentProfile.id);
      setUnreadCounts(counts);
    } catch (error) {
      console.error("읽지 않은 메시지 수 조회 실패:", error);
      setUnreadCounts(new Map());
    }
  }, [taskList, currentProfile?.id]);

  // 초기 로드 및 taskList 변경 시 읽지 않은 메시지 수 조회
  useEffect(() => {
    fetchUnreadCounts();
  }, [fetchUnreadCounts]);

  // 리얼타임 메시지 구독 설정
  useEffect(() => {
    if (!taskList || !currentProfile?.id || taskList.items.length === 0) {
      // Task가 없으면 모든 채널 제거
      channelsRef.current.forEach((channel) => {
        supabase.removeChannel(channel);
      });
      channelsRef.current.clear();
      return;
    }

    const taskIds = taskList.items.map((item) => item.task.id);
    const currentTaskIdSet = new Set(taskIds);
    const existingTaskIdSet = new Set(channelsRef.current.keys());

    // 제거된 Task의 채널 정리
    existingTaskIdSet.forEach((taskId) => {
      if (!currentTaskIdSet.has(taskId)) {
        const channel = channelsRef.current.get(taskId);
        if (channel) {
          supabase.removeChannel(channel);
        }
        channelsRef.current.delete(taskId);
      }
    });

    // 각 Task에 대해 리얼타임 구독 설정
    taskIds.forEach((taskId) => {
      // 이미 구독 중이면 스킵
      if (channelsRef.current.has(taskId)) {
        return;
      }

      const channelName = `task-list-messages:${taskId}`;
      const filter = `task_id=eq.${taskId}`;

      const channel = supabase
        .channel(channelName, {
          config: {
            broadcast: { self: true },
          },
        })
        .on(
          "postgres_changes",
          {
            event: "*", // INSERT, UPDATE, DELETE 모두 구독
            schema: "public",
            table: "messages",
            filter: filter,
          },
          (payload: RealtimePostgresChangesPayload<MessageRow>) => {
            // 메시지 변경 시 읽지 않은 메시지 수를 즉시 다시 조회
            fetchUnreadCounts();
          }
        )
        .subscribe(() => {});

      channelsRef.current.set(taskId, channel);
    });

    // 정리 함수
    return () => {
      channelsRef.current.forEach((channel) => {
        supabase.removeChannel(channel);
      });
      channelsRef.current.clear();
    };
  }, [taskList, currentProfile?.id, fetchUnreadCounts]);

  const handleUpdate = async (title: string) => {
    if (!listId) return;
    await updateTaskList.mutateAsync({ listId, title });
    setEditDialogOpen(false);
  };

  const handleDelete = async () => {
    if (!listId) return;
    await deleteTaskList.mutateAsync(listId);
    navigate("/task-lists");
  };

  const handleRemoveTask = async (taskId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!listId) return;
    await removeTaskFromList.mutateAsync({ listId, taskId });
  };

  // 드래그 앤 드롭을 위한 로컬 상태 (낙관적 업데이트)
  const [localItems, setLocalItems] = useState<Array<{
    id: string;
    task_id: string;
    created_at: string;
    display_order: number;
    task: TaskWithProfiles;
  }> | null>(null);
  
  // taskList가 변경되면 로컬 상태 동기화
  useEffect(() => {
    if (taskList) {
      setLocalItems(taskList.items);
    }
  }, [taskList]);

  // 드래그 종료 핸들러
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || !taskList || !listId) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    // 전체 항목 목록 (페이지네이션되지 않은 전체 목록)
    const allItems = localItems || taskList.items;
    const oldIndex = allItems.findIndex((item) => item.id === activeId);
    const newIndex = allItems.findIndex((item) => item.id === overId);

    if (oldIndex === -1 || newIndex === -1) {
      console.error("항목을 찾을 수 없습니다:", { activeId, overId, oldIndex, newIndex });
      return;
    }

    // 전체 목록에서 순서 변경
    const newAllItems = arrayMove(allItems, oldIndex, newIndex);
    
    // 로컬 상태 즉시 업데이트 (낙관적 업데이트)
    setLocalItems(newAllItems);

    // 새로운 순서 계산 (전체 목록 기준)
    const itemOrders = newAllItems.map((item, index) => ({
      itemId: item.id,
      displayOrder: index,
    }));

    // API 호출로 DB 업데이트
    try {
      await updateTaskListItemsOrder.mutateAsync({
        listId,
        itemOrders,
      });
    } catch (error) {
      // 실패 시 원래 상태로 복구
      console.error("순서 업데이트 실패:", error);
      if (taskList) {
        setLocalItems(taskList.items);
      }
      // 사용자에게 에러 알림
      if (error instanceof Error) {
        alert(`순서 업데이트 실패: ${error.message}`);
      } else {
        alert(`순서 업데이트 실패: 알 수 없는 오류가 발생했습니다.`);
      }
    }
  }, [taskList, localItems, listId, updateTaskListItemsOrder]);

  // 페이지네이션된 Task 목록 계산 (로컬 상태 사용)
  const paginatedItems = useMemo(() => {
    const items = localItems || taskList?.items || [];
    if (items.length === 0) {
      return [];
    }
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  }, [localItems, taskList, currentPage, itemsPerPage]);

  // 총 페이지 수 계산 (로컬 상태 사용)
  const totalPages = useMemo(() => {
    const items = localItems || taskList?.items || [];
    if (items.length === 0) {
      return 1;
    }
    return Math.ceil(items.length / itemsPerPage) || 1;
  }, [localItems, taskList, itemsPerPage]);

  // 페이지 변경 핸들러
  const handlePageChange = (page: number) => {
    updateUrlParams({ page });
  };

  // 페이지 크기 변경 핸들러
  const handlePageSizeChange = (newPageSize: number) => {
    setItemsPerPage(newPageSize);
    sessionStorage.setItem("tablePageSize", newPageSize.toString());
    // 페이지 크기 변경 시 1페이지로 이동
    updateUrlParams({ page: 1 });
  };

  // Task 목록이 변경되면 현재 페이지가 유효한지 확인하고 필요시 조정
  useEffect(() => {
    if (taskList && taskList.items.length > 0) {
      const maxPage = Math.ceil(taskList.items.length / itemsPerPage) || 1;
      if (currentPage > maxPage) {
        updateUrlParams({ page: maxPage });
      }
    }
  }, [taskList, itemsPerPage, currentPage, updateUrlParams]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <DefaultSpinner />
      </div>
    );
  }

  if (error || !taskList) {
    return (
      <div className="md:p-4">
        <div className="text-center">
          <h2 className="mb-2 text-lg font-semibold">목록을 찾을 수 없습니다</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            요청하신 목록이 존재하지 않거나 접근 권한이 없습니다.
          </p>
          <Button onClick={() => navigate("/task-lists")}>목록으로 돌아가기</Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO title={taskList.title} />
      <div className="md:p-4">
        {/* 헤더 */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/task-lists")}
              className="h-9 w-9"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">{taskList.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              수정
            </Button>
            <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              삭제
            </Button>
          </div>
        </div>

        {/* Task 테이블 */}
        {taskList.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="mb-2 text-lg font-semibold">목록이 비어있습니다</p>
            <p className="mb-4 text-sm text-muted-foreground">
              Task 상세 페이지에서 이 목록에 Task를 추가할 수 있습니다.
            </p>
            <Button onClick={() => navigate("/")}>Task 목록 보기</Button>
          </div>
        ) : (
          <>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <div className="overflow-x-scroll">
                <table className="w-full min-w-[1000px] table-fixed">
                  <thead>
                    <tr className="border-b">
                      <th className="w-[8%] px-2 py-3 text-center text-xs font-medium sm:px-4 sm:text-sm">
                        순서
                      </th>
                      <th className="w-[11.5%] px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm">
                        고유 ID
                      </th>
                      <th className="w-[11.5%] px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm">
                        고객명
                      </th>
                      <th className="w-[11.5%] px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm">
                        지시사항
                      </th>
                      <th className="w-[11.5%] px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm">
                        마감일
                      </th>
                      <th className="w-[11.5%] px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm">
                        상태
                      </th>
                      <th className="w-[11.5%] px-2 py-3 text-center text-xs font-medium sm:px-4 sm:text-sm">
                        새 메시지
                      </th>
                      <th className="w-[11.5%] px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm">
                        지시자/담당자
                      </th>
                      <th className="w-[11.5%] px-2 py-3 text-center text-xs font-medium sm:px-4 sm:text-sm">
                        삭제
                      </th>
                    </tr>
                  </thead>
                  <SortableContext
                    items={paginatedItems.map((item) => item.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <tbody>
                      {paginatedItems.map((item) => {
                        const unreadCount = unreadCounts.get(item.task.id) || 0;
                        return (
                          <SortableRow
                            key={item.id}
                            item={item}
                            unreadCount={unreadCount}
                            onRemove={handleRemoveTask}
                            isRemoving={removeTaskFromList.isPending}
                            navigate={navigate}
                          />
                        );
                      })}
                    </tbody>
                  </SortableContext>
                </table>
              </div>
            </DndContext>

            {/* 페이지네이션 */}
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={itemsPerPage}
              totalItems={(localItems || taskList?.items || []).length}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          </>
        )}
      </div>

      {/* 목록 수정 다이얼로그 */}
      <TaskListFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        currentTitle={taskList.title}
        onUpdate={handleUpdate}
        isLoading={updateTaskList.isPending}
      />

      {/* 목록 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>목록 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{taskList.title}&quot; 목록을 삭제하시겠습니까?
              <br />
              목록에 포함된 Task는 삭제되지 않으며, 목록에서만 제거됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTaskList.isPending}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteTaskList.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTaskList.isPending ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
