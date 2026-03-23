import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TaskList } from "@/api/task-list";
import { Folder, Calendar, FileText } from "lucide-react";

interface TaskListCardProps {
  list: TaskList & { item_count?: number };
}

/**
 * 날짜 포맷팅 함수 (YYYY.MM.DD 형식)
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

/**
 * Task 목록 카드 컴포넌트
 * 목록 목록 페이지에서 사용
 */
export function TaskListCard({ list }: TaskListCardProps) {
  const createdDate = formatDate(list.created_at);
  const itemCount = list.item_count !== undefined ? list.item_count : 0;

  return (
    <Link to={`/task-lists/${list.id}`} className="block h-full">
      <Card
        className={cn(
          "group relative overflow-hidden transition-all duration-300",
          "hover:shadow-lg hover:shadow-primary/10",
          "hover:-translate-y-1 hover:border-primary/20",
          "cursor-pointer h-full flex flex-col"
        )}
      >
        {/* 그라데이션 배경 효과 */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        <CardHeader className="relative pb-3 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="mt-1 p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <Folder className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-base font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                  {list.title}
                </CardTitle>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative pt-0 space-y-3 flex-1 flex flex-col justify-end">
          {/* Task 개수 */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span className="font-medium">Task</span>
            </div>
            <Badge variant="secondary" className="font-semibold">
              {itemCount}개
            </Badge>
          </div>

          {/* 생성일 */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span className="font-medium">생성일:</span>
            <span>{createdDate}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
