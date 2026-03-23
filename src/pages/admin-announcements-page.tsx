import { useState, useMemo, useEffect } from "react";
import { SEO } from "@/components/common/seo";
import { AnnouncementListItem } from "@/components/announcement/announcement-list-item";
import { AnnouncementSearchFilter } from "@/components/announcement/announcement-search-filter";
import { useAdminAnnouncements } from "@/hooks/queries/use-admin-announcements";
import { TablePagination } from "@/components/common/table-pagination";
import DefaultSpinner from "@/components/common/default-spinner";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnnouncementCreateDialog } from "@/components/dialog/announcement-create-dialog";
import { AnnouncementEditDialog } from "@/components/dialog/announcement-edit-dialog";
import type { AnnouncementWithDetails } from "@/api/announcement";

export default function AdminAnnouncementsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isActiveFilter, setIsActiveFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"created_at" | "updated_at">("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    const saved = sessionStorage.getItem("announcementPageSize");
    return saved ? parseInt(saved, 10) : 20;
  });
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 모든 데이터 가져오기 (한 번만 서버 호출)
  const { data: allAnnouncements, isLoading, isError } = useAdminAnnouncements();

  // 클라이언트 사이드 필터링 및 정렬
  const filteredAndSortedAnnouncements = useMemo(() => {
    if (!allAnnouncements) return [];

    let filtered = [...allAnnouncements];

    // 검색 필터
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (announcement) =>
          announcement.title.toLowerCase().includes(query) ||
          announcement.content.toLowerCase().includes(query)
      );
    }

    // 활성 여부 필터
    if (isActiveFilter === "active") {
      filtered = filtered.filter((announcement) => announcement.is_active);
    } else if (isActiveFilter === "inactive") {
      filtered = filtered.filter((announcement) => !announcement.is_active);
    }

    // 정렬
    filtered.sort((a, b) => {
      const aValue = sortBy === "created_at" ? a.created_at : a.updated_at;
      const bValue = sortBy === "created_at" ? b.created_at : b.updated_at;

      if (sortOrder === "asc") {
        return aValue.localeCompare(bValue);
      } else {
        return bValue.localeCompare(aValue);
      }
    });

    return filtered;
  }, [allAnnouncements, searchQuery, isActiveFilter, sortBy, sortOrder]);

  // 페이지네이션 적용
  const paginatedAnnouncements = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredAndSortedAnnouncements.slice(startIndex, endIndex);
  }, [filteredAndSortedAnnouncements, currentPage, pageSize]);

  const totalItems = filteredAndSortedAnnouncements.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  // 검색 또는 필터 변경 시 1페이지로 리셋
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, isActiveFilter, sortBy, sortOrder]);

  // 페이지 크기 변경 시 sessionStorage에 저장
  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    sessionStorage.setItem("announcementPageSize", newPageSize.toString());
  };

  // 수정 버튼 클릭 핸들러
  const handleEdit = (id: string) => {
    setEditingId(id);
    setEditDialogOpen(true);
  };

  // 수정 모달 닫기 핸들러
  const handleEditDialogClose = (open: boolean) => {
    setEditDialogOpen(open);
    if (!open) {
      setEditingId(null);
    }
  };

  if (isLoading) {
    return <DefaultSpinner />;
  }

  if (isError) {
    return (
      <div className="w-full p-4">
        <p className="text-muted-foreground text-center">공지사항 목록을 불러올 수 없습니다.</p>
      </div>
    );
  }

  return (
    <>
      <div className="w-full p-4">
        {/* 헤더 */}
        <div className="mb-6 sm:mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="mb-2 text-2xl font-bold sm:text-3xl">공지사항 관리</h1>
            <p className="text-muted-foreground text-sm sm:text-base">공지사항을 관리하세요</p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)} className="shrink-0">
            <Plus className="mr-2 size-4" />
            공지사항 작성
          </Button>
        </div>

        {/* 검색 및 필터 */}
        <div className="mb-4">
          <AnnouncementSearchFilter
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            isActiveFilter={isActiveFilter}
            onIsActiveFilterChange={setIsActiveFilter}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            sortOrder={sortOrder}
            onSortOrderChange={setSortOrder}
          />
        </div>

        {/* 공지사항 목록 */}
        {paginatedAnnouncements && paginatedAnnouncements.length > 0 ? (
          <>
            <div className="space-y-4">
              {paginatedAnnouncements.map((announcement) => (
                <AnnouncementListItem
                  key={announcement.id}
                  announcement={announcement}
                  onEdit={handleEdit}
                />
              ))}
            </div>
            {/* 페이지네이션 */}
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={totalItems}
              onPageChange={setCurrentPage}
              onPageSizeChange={handlePageSizeChange}
              className="mt-6"
            />
          </>
        ) : (
          <div className="py-12 text-center">
            <FileText className="mx-auto mb-4 size-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              {searchQuery || isActiveFilter !== "all"
                ? "검색 결과가 없습니다."
                : "등록된 공지사항이 없습니다."}
            </p>
          </div>
        )}
      </div>

      {/* 생성 다이얼로그 */}
      <AnnouncementCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      {/* 수정 다이얼로그 */}
      <AnnouncementEditDialog
        open={editDialogOpen}
        onOpenChange={handleEditDialogClose}
        announcementId={editingId}
      />
    </>
  );
}
