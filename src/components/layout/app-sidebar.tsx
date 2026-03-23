import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Home,
  Bell,
  User,
  Settings2Icon,
  Ellipsis,
  ChevronDown,
  LogOut,
  FileText,
  Shield,
  Calendar,
  Bot,
  List,
} from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ProfileAvatar } from "@/components/common/profile-avatar";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import LanguageDialog from "../dialog/language-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";
import LogoutDialog from "../dialog/logout-dialog";
import { Button } from "../ui/button";
import ThemeDialog from "../dialog/theme-dialog";
import ChangePasswordDialog from "../dialog/change-password-dialog";
import ChangeEmailDialog from "../dialog/change-email-dialog";
import { useResolvedThemeMode, useCurrentProfile, useIsAdmin } from "@/hooks";
import { Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import logo_dark from "@/assets/logo_dark.png";
import logo_light from "@/assets/logo_light.png";
import { useUnreadNotificationCount } from "@/hooks/queries/use-notifications";
import { useRealtimeNotifications } from "@/hooks/queries/use-realtime-notifications";
import { SidebarMenuBadge } from "@/components/ui/sidebar";

// 로그아웃 메뉴 아이템 컴포넌트
function LogoutMenuItem() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <DropdownMenuItem
        variant="destructive"
        className="cursor-pointer"
        onSelect={(e) => {
          e.preventDefault();
          setDialogOpen(true);
        }}
      >
        <LogOut className="mr-2 h-4 w-4" />
        로그아웃
      </DropdownMenuItem>
      <LogoutDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}

/**
 * 문제 원인 설명:
 *
 * - useIsAdmin은 react-query나 SWR 기반 fetch 혹은 react state 기반인데,
 * - 로그아웃 → 로그인(다른계정) 시, AppSidebar 컴포넌트가 마운트된 상태에서 useIsAdmin 훅의 캐시가 갱신되지 않거나 내부적으로 '변경'을 전달하지 않아서
 * - 예전 권한 정보가 남아 있어서 user management 메뉴 표시가 안 됨.
 * - 새로고침을 하면 프로필 및 admin 여부가 새로 불려서 메뉴가 올바르게 보임.
 *
 * 해결 방법:
 * - 사용자가 로그아웃/로그인(전환)하는 시점, 즉 세션이 바뀔 때 useIsAdmin이나 관련 쿼리의 캐시/정보가 무조건 새로고침(혹은 refetch)되어야 함
 * - 그리고 렌더링은 isAdmin 정보가 정확히 변경될 때까지는 이전 값을 사용하지 않도록 처리(대기 or skeleton UI)
 * - 아래 예시는 supabase의 onAuthStateChange로 세션 변화를 감지해서 강제 재로드 및 useIsAdmin에 의존하는 값 변경을 트리거함
 */

import supabase from "@/lib/supabase";

const getMenuItems = (isAdmin: boolean) => {
  const items = [
    { id: "home", key: "layout.sidebar.menu.home", url: "/", icon: Home },
    {
      id: "notifications",
      key: "layout.sidebar.menu.notifications",
      url: "/notifications",
      icon: Bell,
    },
    {
      id: "schedule",
      key: "layout.sidebar.menu.schedule",
      url: "/schedule",
      icon: Calendar,
    },
    {
      id: "task-lists",
      key: "작업 목록",
      url: "/task-lists",
      icon: List,
    },
    {
      id: "agents",
      key: "AI 에이전트",
      url: "/agents",
      icon: Bot,
    },
    { id: "settings", key: "layout.sidebar.menu.settings", icon: Settings2Icon },
    { id: "profile", key: "layout.sidebar.menu.profile", url: "/profile", icon: User },
  ];

  if (isAdmin) {
    // 관리자만 Tasko 관리 메뉴 추가 (프로필 다음) - Collapsible로 변경
    items.push({
      id: "tasko-management",
      key: "Tasko 관리",
      icon: Shield,
    });
    // 관리자만 게시 버튼 표시
    items.push({ id: "post", key: "layout.sidebar.menu.post", icon: FileText });
  }

  return items;
};

const settingsSubItems = [
  { id: "language", key: "layout.sidebar.settingsSub.language" },
  { id: "theme", key: "layout.sidebar.settingsSub.theme" },
  { id: "change-email", key: "layout.sidebar.settingsSub.changeEmail" },
  { id: "change-password", key: "layout.sidebar.settingsSub.changePassword" },
];

const taskoManagementSubItems = [
  { id: "users-management", key: "사용자 관리", url: "/admin/users" },
  { id: "announcements-management", key: "공지사항 관리", url: "/admin/announcements" },
];

export function AppSidebar() {
  const { i18n, t } = useTranslation();
  const mode = useResolvedThemeMode();
  const { data: profile } = useCurrentProfile();
  const { data: isAdmin, refetch: refetchAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const { isMobile, setOpenMobile, setOpen } = useSidebar();
  const navigate = useNavigate();

  // 알림 관련 훅
  const { data: unreadNotificationCount } = useUnreadNotificationCount();
  useRealtimeNotifications(true); // Realtime 구독 활성화

  // [핵심] 세션/유저 변경에 따라 admin 권한 refetch
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, _session) => {
      // onAuthStateChange 이벤트가 발생하면 isAdmin 쿼리를 강제로 refetch
      if (refetchAdmin) {
        refetchAdmin();
      }
    });
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [refetchAdmin]);

  // admin여부가 아직 판단 안됐으면 skeleton 등 보여줄 수 있음
  if (isAdminLoading) {
    return (
      <Sidebar collapsible="offcanvas">
        <SidebarContent className="bg-background">
          <SidebarGroup>
            <SidebarGroupLabel className="py-6 md:py-8">
              <Link to={"/"}>
                <img
                  alt="logo_character"
                  className="size-8.5 md:size-10"
                  src={mode === "dark" ? logo_light : logo_dark}
                />
              </Link>
            </SidebarGroupLabel>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    );
  }

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarContent className="bg-background">
        {/* 회사 정보 영역 */}
        <SidebarGroup>
          <SidebarGroupLabel className="py-6 md:py-8">
            <Link to={"/"}>
              <img
                alt="logo_character"
                className="size-8.5 md:size-10"
                src={mode === "dark" ? logo_light : logo_dark}
              />
            </Link>
          </SidebarGroupLabel>
        </SidebarGroup>

        {/* 플랫폼 메뉴 */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {getMenuItems(!!isAdmin).map((item) => {
                if (item.id === "settings") {
                  return (
                    <Collapsible key={item.id} className="group/collapsible">
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton className="flex items-center gap-2 rounded-md px-3 py-2 md:gap-3 md:py-6">
                            {item.icon && <item.icon className="size-4! md:size-5!" />}
                            <span className="text-14-regular md:text-16-regular">
                              {t(item.key)}
                            </span>
                            <ChevronDown className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          <div className="flex flex-col">
                            {settingsSubItems.map((sub) => {
                              if (sub.id === "language") {
                                return (
                                  <LanguageDialog key={sub.id}>
                                    <Button
                                      type={"button"}
                                      variant={"ghost"}
                                      className="text-14-regular block w-full rounded-md px-6 py-2 text-left"
                                    >
                                      {t(sub.key)}
                                    </Button>
                                  </LanguageDialog>
                                );
                              }

                              if (sub.id === "theme") {
                                return (
                                  <ThemeDialog key={sub.id}>
                                    <Button
                                      type={"button"}
                                      variant={"ghost"}
                                      className="text-14-regular block w-full rounded-md px-6 py-2 text-left"
                                    >
                                      {t(sub.key)}
                                    </Button>
                                  </ThemeDialog>
                                );
                              }

                              if (sub.id === "change-email") {
                                return (
                                  <ChangeEmailDialog key={sub.id}>
                                    <Button
                                      type={"button"}
                                      variant={"ghost"}
                                      className="text-14-regular block w-full rounded-md px-6 py-2 text-left"
                                    >
                                      {t(sub.key)}
                                    </Button>
                                  </ChangeEmailDialog>
                                );
                              }

                              if (sub.id === "change-password") {
                                return (
                                  <ChangePasswordDialog key={sub.id}>
                                    <Button
                                      type={"button"}
                                      variant={"ghost"}
                                      className="text-14-regular block w-full rounded-md px-6 py-2 text-left"
                                    >
                                      {t(sub.key)}
                                    </Button>
                                  </ChangePasswordDialog>
                                );
                              }

                              return null;
                            })}
                          </div>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                }

                if (item.id === "tasko-management") {
                  return (
                    <Collapsible key={item.id} className="group/collapsible">
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton className="flex items-center gap-2 rounded-md px-3 py-2 md:gap-3 md:py-6">
                            {item.icon && <item.icon className="size-4! md:size-5!" />}
                            <span className="text-14-regular md:text-16-regular">
                              Tasko 관리
                            </span>
                            <ChevronDown className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          <div className="flex flex-col">
                            {taskoManagementSubItems.map((sub) => (
                              <Button
                                key={sub.id}
                                type="button"
                                variant="ghost"
                                className="text-14-regular block w-full rounded-md px-6 py-2 text-left"
                                asChild
                              >
                                <Link
                                  to={sub.url}
                                  onClick={() => {
                                    // 모바일에서만 사이드바 닫기
                                    if (isMobile) {
                                      setOpenMobile(false);
                                    }
                                  }}
                                >
                                  {sub.key}
                                </Link>
                              </Button>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                }

                // 일반 메뉴
                return (
                  <SidebarMenuItem key={item.id}>
                    {item.id !== "post" ? (
                      <SidebarMenuButton asChild>
                        <Link
                          to={item.url ?? "#"}
                          className="flex items-center gap-2 rounded-md px-3 py-2 md:gap-3 md:py-6"
                          onClick={() => {
                            // 모바일에서만 사이드바 닫기
                            if (isMobile) {
                              setOpenMobile(false);
                            }
                          }}
                        >
                          {item.icon && <item.icon className="size-4! md:size-5!" />}
                          <span className="text-14-regular md:text-16-regular">
                            {item.id === "agents" ? item.key : t(item.key)}
                          </span>
                          {/* 알림 메뉴에 읽지 않은 알림 수 배지 표시 */}
                          {item.id === "notifications" && unreadNotificationCount !== undefined && unreadNotificationCount > 0 && (
                            <SidebarMenuBadge className="bg-red-500 text-white">
                              {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                            </SidebarMenuBadge>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    ) : (
                      <Button
                        type="button"
                        className="xs:text-14-semibold md:text-16-semibold text-background bg-foreground my-2 w-full cursor-pointer rounded-full py-2 md:my-3 md:py-3"
                        onClick={() => {
                          navigate("/admin/announcements");
                          // 모바일에서만 사이드바 닫기
                          if (isMobile) {
                            setOpenMobile(false);
                          }
                        }}
                      >
                        {t(item.key)}
                      </Button>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* 하단 사용자 정보 */}
      <SidebarFooter className="bg-background">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                {/* 트리거는 실제 버튼/메뉴 버튼으로 */}
                <Button
                  type="button"
                  variant="ghost"
                  className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-3"
                >
                  <div className="flex items-center gap-2">
                    <ProfileAvatar avatarUrl={profile?.avatar_url} size={40} />
                    <div className="text-14-regular flex flex-col text-left">
                      <div>{profile?.full_name || "사용자"}</div>
                      <div className="text-muted-foreground line-clamp-1 text-xs">
                        {profile?.email || ""}
                      </div>
                    </div>
                  </div>
                  <Ellipsis />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-56 mb-2">
                {/* 사용자 정보 헤더 */}
                <DropdownMenuLabel className="flex flex-col gap-1 p-3">
                  <div className="flex items-center gap-2">
                    <ProfileAvatar avatarUrl={profile?.avatar_url} size={32} />
                    <div className="flex flex-col">
                      <div className="text-sm font-medium">{profile?.full_name || "사용자"}</div>
                      <div className="text-muted-foreground text-xs">{profile?.email || ""}</div>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {/* 로그아웃 버튼 */}
                <LogoutMenuItem />
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
