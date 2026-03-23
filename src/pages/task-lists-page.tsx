import { useState } from "react";
import { SEO } from "@/components/common/seo";
import { useTaskLists, useDeleteTaskList } from "@/hooks";
import { TaskListCard } from "@/components/task-list/task-list-card";
import { CreateListDialog } from "@/components/task-list/create-list-dialog";
import { TaskListFormDialog } from "@/components/task-list/task-list-form-dialog";
import { Button } from "@/components/ui/button";
import DefaultSpinner from "@/components/common/default-spinner";
import { Plus, Folder } from "lucide-react";
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
import { useCreateTaskList, useUpdateTaskList } from "@/hooks/mutations/use-task-list";

/**
 * Task 목록 목록 페이지
 */
export default function TaskListsPage() {
  const { data: taskLists = [], isLoading } = useTaskLists();
  const createTaskList = useCreateTaskList();
  const updateTaskList = useUpdateTaskList();
  const deleteTaskList = useDeleteTaskList();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [selectedListTitle, setSelectedListTitle] = useState<string>("");

  const handleCreate = async (title: string) => {
    await createTaskList.mutateAsync(title);
    setCreateDialogOpen(false);
  };

  const handleEdit = (listId: string) => {
    const list = taskLists.find((l) => l.id === listId);
    if (list) {
      setSelectedListId(listId);
      setSelectedListTitle(list.title);
      setEditDialogOpen(true);
    }
  };

  const handleUpdate = async (title: string) => {
    if (!selectedListId) return;
    await updateTaskList.mutateAsync({ listId: selectedListId, title });
    setEditDialogOpen(false);
    setSelectedListId(null);
    setSelectedListTitle("");
  };

  const handleDeleteClick = (listId: string) => {
    const list = taskLists.find((l) => l.id === listId);
    if (list) {
      setSelectedListId(listId);
      setSelectedListTitle(list.title);
      setDeleteDialogOpen(true);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedListId) return;
    await deleteTaskList.mutateAsync(selectedListId);
    setDeleteDialogOpen(false);
    setSelectedListId(null);
    setSelectedListTitle("");
  };

  return (
    <>
      <div className="md:p-4">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="mb-2 text-20-semibold  md:text-24-semibold">작업 목록</h1>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            새 목록 만들기
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <DefaultSpinner />
          </div>
        ) : taskLists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Folder className="mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="mb-2 text-lg font-semibold">목록이 없습니다</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              업무를 그룹으로 묶어 관리할 수 있는 목록을 만들어보세요.
            </p>
            <Button className="hidden" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              첫 번째 목록 만들기
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 ">
            {taskLists.map((list) => (
              <TaskListCard key={list.id} list={list} />
            ))}
          </div>
        )}
      </div>

      {/* 목록 생성 다이얼로그 */}
      <CreateListDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreate={handleCreate}
        isLoading={createTaskList.isPending}
      />

      {/* 목록 수정 다이얼로그 */}
      <TaskListFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        currentTitle={selectedListTitle}
        onUpdate={handleUpdate}
        isLoading={updateTaskList.isPending}
      />

      {/* 목록 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>목록 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{selectedListTitle}&quot; 목록을 삭제하시겠습니까?
              <br />
              목록에 포함된 Task는 삭제되지 않으며, 목록에서만 제거됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTaskList.isPending}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
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
