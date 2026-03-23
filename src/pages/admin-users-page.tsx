import { SEO } from "@/components/common/seo";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useUsers, useToggleUserStatus } from "@/hooks";
import { toast } from "sonner";
import { generateErrorMessage } from "@/lib/error";
import DefaultSpinner from "@/components/common/default-spinner";
import { InviteUserDialog } from "@/components/dialog/invite-user-dialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState, useMemo } from "react";
import type { Database, Tables } from "@/database.type";
import { Search, Filter, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProfileAvatar } from "@/components/common/profile-avatar";

type Profile = Tables<"profiles">;

export default function AdminUsersPage() {
  const { data: users, isLoading, isError } = useUsers();
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<{
    userId: string;
    email: string;
    newStatus: boolean;
  } | null>(null);

  const { mutate: toggleUserStatus, isPending: isToggling } = useToggleUserStatus({
    onSuccess: (_, variables) => {
      toast.success(
        variables.isActive ? "사용자가 활성화되었습니다." : "사용자가 비활성화되었습니다.",
        {
          position: "bottom-right",
        },
      );
      setConfirmDialogOpen(false);
      setPendingToggle(null);
    },
    onError: (error) => {
      const message = generateErrorMessage(error);
      toast.error(message, {
        position: "bottom-right",
      });
      setConfirmDialogOpen(false);
      setPendingToggle(null);
    },
  });

  const handleStatusChange = (userId: string, email: string, currentStatus: boolean | null) => {
    const newStatus = !currentStatus;
    setPendingToggle({ userId, email, newStatus });
    setConfirmDialogOpen(true);
  };

  const handleConfirmToggle = () => {
    if (pendingToggle) {
      toggleUserStatus({
        userId: pendingToggle.userId,
        isActive: pendingToggle.newStatus,
      });
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatLastActive = (dateString: string | null) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    const diffWeeks = Math.floor(diffDays / 7);

    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;
    if (diffWeeks < 4) return `${diffWeeks}주 전`;
    return formatDate(dateString);
  };

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    return users.filter((user) => {
      const matchesSearch =
        searchQuery === "" ||
        user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole =
        roleFilter === "all" ||
        (roleFilter === "admin" && user.role === "admin") ||
        (roleFilter === "member" && user.role !== "admin");
      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, roleFilter]);

  if (isLoading) {
    return <DefaultSpinner />;
  }

  if (isError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-muted-foreground text-center">사용자 목록을 불러올 수 없습니다.</p>
      </div>
    );
  }

  return (
    <>
      <div className="w-full p-4">
        {/* 헤더 */}
        <div className="mb-6 sm:mb-8">
          <h1 className="mb-2 text-2xl font-bold sm:text-3xl">전체 사용자</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            팀 멤버와 계정 권한을 관리하세요
          </p>
        </div>

        {/* 검색 및 필터 바 */}
        <div className="mb-4 gap-4 flex flex-col md:flex-row w-full md:justify-between">
          {/* 검색 필드 */}
          <div className="relative md:w-4/10">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              type="search"
              placeholder="이름 또는 이메일로 사용자 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>


          <div className="flex itesm-center gap-4 justify-between">
          {/* 필터 드롭다운 */}
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <Filter className="mr-2 size-4" />
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="member">Member</SelectItem>
            </SelectContent>
          </Select>

          {/* Add User 버튼 */}
          <InviteUserDialog>
            <Button className="w-auto">
              <UserPlus className="mr-2 size-4" />
              사용자 추가
            </Button>
          </InviteUserDialog>
          </div>
        </div>

        {/* 사용자 테이블 */}
        {filteredUsers && filteredUsers.length > 0 ? (
          <div className="overflow-x-scroll">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm">
                    사용자
                  </th>
                  <th className="px-2 py-3 text-center text-xs font-medium sm:px-4 sm:text-sm">
                    역할
                  </th>
                  <th className="px-2 py-3 text-center text-xs font-medium sm:px-4 sm:text-sm">
                    상태
                  </th>
                  <th className="px-2 py-3 text-center text-xs font-medium sm:px-4 sm:text-sm">
                    가입일
                  </th>
                  <th className="px-2 py-3 text-center text-xs font-medium sm:px-4 sm:text-sm">
                    상태 변경
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/50 border-b transition-colors">
                    <td className="px-2 py-3 sm:px-4 sm:py-4">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="hidden shrink-0 sm:block">
                          <ProfileAvatar avatarUrl={user.avatar_url} size={40} />
                        </div>
                        <div className="shrink-0 sm:hidden">
                          <ProfileAvatar avatarUrl={user.avatar_url} size={32} />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-xs font-medium sm:text-sm">
                            {user.full_name || "-"}
                          </div>
                          <div className="text-muted-foreground truncate text-xs sm:text-sm">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-center sm:px-4 sm:py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          user.role === "admin"
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {user.role === "admin" ? "관리자" : "멤버"}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-center sm:px-4 sm:py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          user.is_active
                            ? "bg-black text-white dark:bg-white dark:text-black"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {user.is_active ? "활성" : "비활성"}
                      </span>
                    </td>
                    <td className="text-muted-foreground px-2 py-3 text-center text-xs sm:px-4 sm:py-4 sm:text-sm">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="px-2 py-3 text-center sm:px-4 sm:py-4">
                      <Switch
                        checked={user.is_active ?? false}
                        onCheckedChange={() =>
                          handleStatusChange(user.id, user.email, user.is_active)
                        }
                        disabled={isToggling}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">
              {searchQuery || roleFilter !== "all"
                ? "검색 결과가 없습니다."
                : "등록된 사용자가 없습니다."}
            </p>
          </div>
        )}

        <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
          <DialogContent showCloseButton>
            <DialogHeader>
              <DialogTitle>사용자 상태 변경</DialogTitle>
              <DialogDescription>
                {pendingToggle &&
                  `정말로 ${pendingToggle.email} 사용자를 ${
                    pendingToggle.newStatus ? "활성화" : "비활성화"
                  }하시겠습니까?`}
                {pendingToggle?.newStatus === false && " 비활성화된 사용자는 로그인할 수 없습니다."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isToggling}>
                  취소
                </Button>
              </DialogClose>
              <Button
                type="button"
                variant={pendingToggle?.newStatus === false ? "destructive" : "default"}
                onClick={handleConfirmToggle}
                disabled={isToggling}
              >
                {isToggling ? "처리 중..." : "확인"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
