import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Filter } from "lucide-react";

type AnnouncementSearchFilterProps = {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  isActiveFilter: string;
  onIsActiveFilterChange: (value: string) => void;
  sortBy: "created_at" | "updated_at";
  onSortByChange: (value: "created_at" | "updated_at") => void;
  sortOrder: "asc" | "desc";
  onSortOrderChange: (value: "asc" | "desc") => void;
};

export function AnnouncementSearchFilter({
  searchQuery,
  onSearchChange,
  isActiveFilter,
  onIsActiveFilterChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
}: AnnouncementSearchFilterProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      {/* 검색 필드 */}
      <div className="relative flex-1 md:max-w-md">
        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          type="search"
          placeholder="제목 또는 내용으로 검색..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* 필터 및 정렬 */}
      <div className="flex gap-2">
        {/* 활성 여부 필터 */}
        <Select value={isActiveFilter} onValueChange={onIsActiveFilterChange}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <Filter className="mr-2 size-4" />
            <SelectValue placeholder="상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="active">활성</SelectItem>
            <SelectItem value="inactive">비활성</SelectItem>
          </SelectContent>
        </Select>

        {/* 정렬 기준 */}
        <Select value={sortBy} onValueChange={(value) => onSortByChange(value as "created_at" | "updated_at")}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="정렬 기준" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at">생성일</SelectItem>
            <SelectItem value="updated_at">수정일</SelectItem>
          </SelectContent>
        </Select>

        {/* 정렬 순서 */}
        <Select value={sortOrder} onValueChange={(value) => onSortOrderChange(value as "asc" | "desc")}>
          <SelectTrigger className="w-full sm:w-[120px]">
            <SelectValue placeholder="순서" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">최신순</SelectItem>
            <SelectItem value="asc">오래된순</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
