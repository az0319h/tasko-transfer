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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface TaskListFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTitle: string;
  onUpdate: (title: string) => Promise<void>;
  isLoading?: boolean;
}

/**
 * 목록 제목 수정 다이얼로그
 */
export function TaskListFormDialog({
  open,
  onOpenChange,
  currentTitle,
  onUpdate,
  isLoading = false,
}: TaskListFormDialogProps) {
  const [title, setTitle] = useState(currentTitle);

  // 다이얼로그가 열릴 때마다 현재 제목으로 초기화
  useEffect(() => {
    if (open) {
      setTitle(currentTitle);
    }
  }, [open, currentTitle]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || title.trim() === currentTitle) {
      return;
    }
    await onUpdate(title.trim());
  };

  const handleCancel = () => {
    setTitle(currentTitle);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>목록 제목 수정</DialogTitle>
          <DialogDescription>목록 제목을 수정하세요</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">기회</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="목록 제목"
                disabled={isLoading}
                autoFocus
                maxLength={200}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || title.trim() === currentTitle || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  수정 중...
                </>
              ) : (
                "수정"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
