import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface TablePaginationProps {
  /** 현재 페이지 (1부터 시작) */
  currentPage: number;
  /** 총 페이지 수 */
  totalPages: number;
  /** 페이지당 항목 수 */
  pageSize: number;
  /** 페이지당 항목 수 옵션 */
  pageSizeOptions?: number[];
  /** 총 항목 수 */
  totalItems: number;
  /** 선택된 항목 수 */
  selectedCount?: number;
  /** 페이지 변경 핸들러 */
  onPageChange: (page: number) => void;
  /** 페이지 크기 변경 핸들러 */
  onPageSizeChange: (pageSize: number) => void;
  /** 클래스명 */
  className?: string;
}

/**
 * 테이블 페이지네이션 컴포넌트
 *
 * 이미지와 유사한 레이아웃:
 * - 좌측: 선택된 행 수 표시
 * - 우측: Rows per page Select, Page X of Y, 네비게이션 버튼들
 */
export function TablePagination({
  currentPage,
  totalPages,
  pageSize,
  pageSizeOptions = [10, 20, 30, 50, 100],
  totalItems,
  selectedCount = 0,
  onPageChange,
  onPageSizeChange,
  className,
}: TablePaginationProps) {
  const handlePageSizeChange = (value: string) => {
    const newPageSize = parseInt(value, 10);
    onPageSizeChange(newPageSize);
    // 페이지 크기 변경 시 1페이지로 이동
    onPageChange(1);
  };

  const handleFirstPage = () => {
    if (currentPage > 1) {
      onPageChange(1);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const handleLastPage = () => {
    if (currentPage < totalPages) {
      onPageChange(totalPages);
    }
  };

  const isFirstPage = currentPage === 1;
  const isLastPage = currentPage === totalPages || totalPages === 0;

  return (
    <div
      className={cn(
        "grid grid-cols-3 grid-rows-2 px-2 py-4 md:flex md:flex-row md:items-center md:justify-between md:gap-0",
        className,
      )}
    >
      {/* 좌측: 선택된 행 수 표시 */}
      <div className="text-muted-foreground col-start-1 col-end-3 text-xs sm:text-sm">
        {selectedCount > 0 ? (
          <span className="whitespace-nowrap">
            {selectedCount} of {totalItems} row(s) selected
          </span>
        ) : (
          <span className="text-muted-foreground/50 whitespace-nowrap">
            {totalItems} row(s) total
          </span>
        )}
      </div>

      {/* 우측: 페이지네이션 컨트롤 */}
      <div className="col-start-1 col-end-4 row-start-2 flex items-center gap-3 sm:flex-row sm:items-center sm:gap-4 md:gap-6">
        {/* Rows per page */}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground hidden text-xs sm:inline sm:text-sm">
            Rows per page
          </span>
          <span className="text-muted-foreground text-xs sm:hidden">Rows</span>
          <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
            <SelectTrigger className="h-8 w-[60px] text-xs sm:h-9 sm:w-[70px] sm:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Page X of Y */}
        <div className="text-muted-foreground hidden text-xs sm:block sm:text-sm">
          Page {currentPage} of {totalPages || 1}
        </div>
        <div className="text-muted-foreground text-xs sm:hidden">
          {currentPage} / {totalPages || 1}
        </div>

        {/* 네비게이션 버튼들 */}
        <div className="flex items-center gap-1">
          {/* 첫 페이지 */}
          <Button
            variant="outline"
            size="icon-sm"
            className="h-8 w-8 sm:h-9 sm:w-9"
            onClick={handleFirstPage}
            disabled={isFirstPage}
            aria-label="Go to first page"
          >
            <ChevronFirst className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>

          {/* 이전 페이지 */}
          <Button
            variant="outline"
            size="icon-sm"
            className="h-8 w-8 sm:h-9 sm:w-9"
            onClick={handlePreviousPage}
            disabled={isFirstPage}
            aria-label="Go to previous page"
          >
            <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>

          {/* 다음 페이지 */}
          <Button
            variant="outline"
            size="icon-sm"
            className="h-8 w-8 sm:h-9 sm:w-9"
            onClick={handleNextPage}
            disabled={isLastPage}
            aria-label="Go to next page"
          >
            <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>

          {/* 마지막 페이지 */}
          <Button
            variant="outline"
            size="icon-sm"
            className="h-8 w-8 sm:h-9 sm:w-9"
            onClick={handleLastPage}
            disabled={isLastPage}
            aria-label="Go to last page"
          >
            <ChevronLast className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
