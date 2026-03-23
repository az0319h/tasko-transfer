import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Plus, Loader2 } from "lucide-react";
import {
  useTaskListsForTask,
  useCreateTaskList,
} from "@/hooks";
import { addTaskToList, removeTaskFromList } from "@/api/task-list";
import { useQueryClient } from "@tanstack/react-query";
import { CreateListDialog } from "./create-list-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AddToListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
}

/**
 * Task 상세 페이지에서 사용하는 "목록에 추가" 다이얼로그
 * 여러 목록을 중복 선택하고 확인 버튼으로 일괄 추가/제거 가능
 */
export function AddToListDialog({ open, onOpenChange, taskId }: AddToListDialogProps) {
  const { data: taskLists = [], isLoading } = useTaskListsForTask(taskId);
  const createTaskList = useCreateTaskList();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // 선택된 목록 ID들 (Set으로 관리)
  const [selectedListIds, setSelectedListIds] = useState<Set<string>>(new Set());

  // 모달이 열릴 때마다 현재 task가 포함된 목록들로 초기화
  useEffect(() => {
    if (open && taskLists.length > 0) {
      const currentListIds = new Set(
        taskLists.filter((list) => list.has_task).map((list) => list.id)
      );
      setSelectedListIds(currentListIds);
    }
  }, [open, taskLists]);

  // 목록 선택/해제 토글
  const handleToggleList = (listId: string) => {
    setSelectedListIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(listId)) {
        newSet.delete(listId);
      } else {
        newSet.add(listId);
      }
      return newSet;
    });
  };

  // 확인 버튼 클릭 시 일괄 추가/제거 처리
  const handleConfirm = async () => {
    if (!taskId || isProcessing) return;

    const currentListIds = new Set(
      taskLists.filter((list) => list.has_task).map((list) => list.id)
    );

    // 추가할 목록들 (선택되었지만 현재 포함되지 않은 목록)
    const toAdd = Array.from(selectedListIds).filter(
      (id) => !currentListIds.has(id)
    );

    // 제거할 목록들 (선택 해제되었지만 현재 포함된 목록)
    const toRemove = Array.from(currentListIds).filter(
      (id) => !selectedListIds.has(id)
    );

    // 변경사항이 없으면 모달만 닫기
    if (toAdd.length === 0 && toRemove.length === 0) {
      onOpenChange(false);
      return;
    }

    setIsProcessing(true);

    try {
      // 제거 먼저 처리
      for (const listId of toRemove) {
        await removeTaskFromList(listId, taskId);
        // 쿼리 무효화
        queryClient.invalidateQueries({ queryKey: ["task-lists", "detail", listId] });
        queryClient.invalidateQueries({ queryKey: ["task-lists", "items", listId] });
      }

      // 추가 처리
      for (const listId of toAdd) {
        await addTaskToList(listId, taskId);
        // 쿼리 무효화
        queryClient.invalidateQueries({ queryKey: ["task-lists", "detail", listId] });
        queryClient.invalidateQueries({ queryKey: ["task-lists", "items", listId] });
      }

      // 전체 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ["task-lists", "for-task", taskId] });
      queryClient.invalidateQueries({ queryKey: ["task-lists", "list"] });

      // 성공 메시지 표시
      const addCount = toAdd.length;
      const removeCount = toRemove.length;
      if (addCount > 0 && removeCount > 0) {
        toast.success(`${addCount}개 목록에 추가하고 ${removeCount}개 목록에서 제거했습니다.`);
      } else if (addCount > 0) {
        toast.success(`${addCount}개 목록에 추가했습니다.`);
      } else if (removeCount > 0) {
        toast.success(`${removeCount}개 목록에서 제거했습니다.`);
      }

      onOpenChange(false);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(msg || "목록 업데이트에 실패했습니다.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateAndAdd = async (title: string) => {
    try {
      const newList = await createTaskList.mutateAsync(title);
      // 새로 생성된 목록을 선택 목록에 추가
      setSelectedListIds((prev) => {
        const newSet = new Set(prev);
        newSet.add(newList.id);
        return newSet;
      });
      setCreateDialogOpen(false);
      // 새 목록은 자동으로 선택되지만 확인 버튼을 눌러야 추가됨
    } catch (error) {
      // 에러는 mutation에서 toast로 처리됨
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-125">
          <DialogHeader>
            <DialogTitle>목록에 추가</DialogTitle>
            <DialogDescription>
              이 Task를 추가할 목록을 선택하세요.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-100 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : taskLists.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                아직 생성한 목록이 없습니다.
                <br />
                새 목록을 만들어보세요.
              </div>
            ) : (
              <div className="space-y-1">
                {taskLists.map((list) => {
                  const isSelected = selectedListIds.has(list.id);
                  return (
                    <button
                      key={list.id}
                      onClick={() => !isProcessing && handleToggleList(list.id)}
                      disabled={isProcessing}
                      className={cn(
                        "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors",
                        "hover:bg-accent hover:text-accent-foreground",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                        isSelected && "bg-accent"
                      )}
                    >
                      <span className="flex-1 truncate">{list.title}</span>
                      {isSelected && (
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(true)}
              disabled={isProcessing}
              className="w-full sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" />
              새 목록 만들기
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isProcessing}
              className="w-full sm:w-auto"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  처리 중...
                </>
              ) : (
                "확인"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateListDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreate={handleCreateAndAdd}
        isLoading={createTaskList.isPending}
      />
    </>
  );
}
