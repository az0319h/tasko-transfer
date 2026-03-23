import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { TaskCalendar } from "@/components/schedule/task-calendar";
import { useIsAdmin, useUsers, useCurrentProfile } from "@/hooks";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProfileAvatar } from "@/components/common/profile-avatar";
import DefaultSpinner from "@/components/common/default-spinner";
import type { Tables } from "@/database.type";

type CalendarView = "dayGridMonth" | "timeGridWeek" | "timeGridDay";
type Profile = Tables<"profiles">;

function getViewFromUrl(viewParam: string | null): CalendarView {
  if (viewParam === "month") return "dayGridMonth";
  if (viewParam === "day") return "timeGridDay";
  return "timeGridWeek"; // 기본값: 주
}

export default function SchedulePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get("view");
  const viewModeParam = searchParams.get("viewMode");
  const initialView = getViewFromUrl(viewParam);
  
  const { data: isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const { data: users, isLoading: usersLoading } = useUsers();
  const { data: currentProfile } = useCurrentProfile();

  // URL에서 raw viewMode 읽기 (검증 전)
  const rawViewMode = viewModeParam || "me";

  // 구성원 목록: 일반 멤버만, 현재 사용자 제외 (내 일정은 별도 옵션)
  const memberUsers = useMemo(() => {
    if (!users || !currentProfile) return [];
    return users.filter((user: Profile) => {
      if (user.role === "admin") return false;
      if (user.id === currentProfile.id) return false;
      return true;
    });
  }, [users, currentProfile]);

  // 권한 검증: 관리자이고, 요청한 userId가 memberUsers에 있을 때만 다른 사용자 일정 조회 허용
  const canViewOtherUser =
    rawViewMode !== "me" &&
    !!isAdmin &&
    memberUsers.some((u) => u.id === rawViewMode);

  // 검증된 viewMode (비인가 시 "me"로 강제)
  const viewMode = canViewOtherUser ? rawViewMode : "me";
  const isOtherUserMode = viewMode !== "me";

  const selectedUser = isOtherUserMode ? users?.find((u) => u.id === viewMode) : null;

  if (isAdminLoading || usersLoading) {
    return (
      <div className="md:p-4">
        <DefaultSpinner />
      </div>
    );
  }

  return (
    <div className="md:p-4">
      <div className="mb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">캘린더</h1>
            <p className="text-muted-foreground mt-2">
              {isOtherUserMode && selectedUser
                ? `${selectedUser.full_name || selectedUser.email || "사용자"}님의 일정을 확인할 수 있습니다.`
                : "업무 기반 일정을 캘린더에서 확인하고 관리할 수 있습니다."}
            </p>
          </div>
          
          {/* 관리자용 일정 조회 옵션 선택 */}
          {isAdmin && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                일정 조회:
              </label>
              <Select
                value={viewMode}
                onValueChange={(value) => {
                  const newParams = new URLSearchParams(searchParams);
                  if (value === "me") {
                    newParams.delete("viewMode");
                  } else {
                    newParams.set("viewMode", value);
                  }
                  setSearchParams(newParams, { replace: true });
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="일정 조회 선택">
                    {viewMode === "me"
                      ? "내 일정"
                      : selectedUser?.full_name || selectedUser?.email || "사용자"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="me">
                    <div className="flex items-center gap-2">
                      <ProfileAvatar 
                        avatarUrl={currentProfile?.avatar_url} 
                        size={20}
                        alt={currentProfile?.full_name || currentProfile?.email || "내 프로필"}
                      />
                      <span>내 일정</span>
                    </div>
                  </SelectItem>
                  {memberUsers.map((user: Profile) => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex items-center gap-2">
                        <ProfileAvatar 
                          avatarUrl={user.avatar_url} 
                          size={20}
                          alt={user.full_name || user.email || "사용자"}
                        />
                        <span>{user.full_name || user.email || "사용자"}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {/* 단일 캘린더: 내 일정 또는 선택한 구성원 일정 */}
      <div className="bg-card rounded-lg border p-4 md:p-6">
        <TaskCalendar 
          initialView={initialView} 
          selectedUserId={viewMode === "me" ? undefined : viewMode}
          readOnly={isOtherUserMode}
        />
      </div>
    </div>
  );
}
