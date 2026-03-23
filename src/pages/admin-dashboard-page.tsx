import { useState, useMemo, useEffect, useRef } from "react";
import { Link, useSearchParams, useNavigate, useLocation } from "react-router";
import { Search, Plus, ArrowUpDown, ChevronDown, Mail, CheckCircle2, XCircle, Bell } from "lucide-react";
import {
  useIsAdmin,
  useTasksForMember,
  useTasksForAdmin,
  useSelfTasks,
  useTasksAsReference,
  useCurrentProfile,
  useRealtimeDashboardMessages,
} from "@/hooks";
import { useDebounce } from "@/hooks";
import { TaskStatusChangeDialog } from "@/components/dialog/task-status-change-dialog";
import { useUpdateTaskStatus, useCreateTask, useUpdateTask } from "@/hooks/mutations/use-task";
import { TaskFormDialog } from "@/components/task/task-form-dialog";
import { useCreateMessageWithFiles } from "@/hooks/mutations/use-message";
import { uploadTaskFile } from "@/api/storage";
import type { TaskCreateFormData, TaskCreateSelfTaskFormData, TaskCreateSpecificationFormData, TaskUpdateFormData } from "@/schemas/task/task-schema";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import DefaultSpinner from "@/components/common/default-spinner";
import { TablePagination } from "@/components/common/table-pagination";
import { TaskStatusBadge } from "@/components/common/task-status-badge";
import { DashboardMetrics } from "@/components/dashboard/dashboard-metrics";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TaskWithProfiles } from "@/api/task";
import { checkDueDateExceeded } from "@/api/task";
import type { TaskStatus } from "@/lib/task-status";
import { toast } from "sonner";

/**
 * 날짜를 YYYY-MM-DD 형식으로 포맷
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 날짜를 한국어 형식으로 포맷 (예: "1월 29일")
 */
function formatDateKorean(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return dateObj.toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
  });
}

/**
 * 두 날짜 사이에 주말(토요일, 일요일)이 있는지 확인
 * @param startDate 시작 날짜
 * @param endDate 종료 날짜
 * @returns 주말이 있으면 true, 없으면 false
 */
function hasWeekendBetween(startDate: Date | string, endDate: Date | string): boolean {
  const start = typeof startDate === "string" ? new Date(startDate) : startDate;
  const end = typeof endDate === "string" ? new Date(endDate) : endDate;
  
  // 시작일과 종료일을 날짜만 비교 (시간 제거)
  const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  
  // 시작일부터 종료일 전날까지 확인 (종료일은 제외)
  const current = new Date(startDateOnly);
  while (current < endDateOnly) {
    const dayOfWeek = current.getDay(); // 0 = 일요일, 6 = 토요일
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return true;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return false;
}

/**
 * 마감일 포맷팅 (TaskCard 로직 재사용)
 */
function formatDueDate(dateString: string | null | undefined): string | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  return date.toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });
}

/**
 * 생성일 포맷팅 (예: 26년 01월 25일)
 */
function formatCreatedDate(dateString: string | null | undefined): string | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}년 ${month}월 ${day}일`;
}

/**
 * 날짜 차이 계산 (일수)
 */
function calculateDaysDifference(dueDateString: string | null | undefined): number | null {
  if (!dueDateString) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(dueDateString);
  dueDate.setHours(0, 0, 0, 0);

  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * D-Day 표시 텍스트 생성
 */
function getDDayText(daysDiff: number | null): string {
  if (daysDiff === null) return "";

  if (daysDiff > 0) {
    return `(D-${daysDiff})`;
  } else if (daysDiff === 0) {
    return "(D-Day)";
  } else {
    return `(D+${Math.abs(daysDiff)})`;
  }
}

/**
 * 마감일 색상 클래스 결정
 */
function getDueDateColorClass(daysDiff: number | null, taskStatus: TaskStatus): string {
  if (daysDiff === null) return "text-muted-foreground";

  // 이미 승인된 Task는 기본 색상
  if (taskStatus === "APPROVED") {
    return "text-muted-foreground";
  }

  if (daysDiff === 0) {
    // D-Day: 빨간색
    return "text-destructive font-semibold";
  } else if (daysDiff === 1) {
    // D-1: 주황색
    return "text-orange-600 dark:text-orange-500 font-medium";
  } else if (daysDiff >= 2 && daysDiff <= 7) {
    // D-2 ~ D-7: 파란색
    return "text-blue-600 dark:text-blue-500 font-medium";
  } else if (daysDiff < 0) {
    // D+1 이상 (마감일 지남, 승인 안됨): 빨간색 (D-Day와 동일)
    return "text-destructive font-semibold";
  } else {
    // D-8 이상: 회색
    return "text-muted-foreground";
  }
}

type DashboardTab = "my-tasks" | "all-tasks" | "approved-tasks" | "self-tasks" | "reference-tasks";
type StatusParam = "all" | "assigned" | "in_progress" | "waiting_confirm" | "rejected" | "approved";
type SortDueParam = "asc" | "desc";
type SortEmailSentParam = "asc" | "desc";
type EmailSentParam = "all" | "sent" | "not_sent";
type CategoryParam = "all" | "REVIEW" | "REVISION" | "CONTRACT" | "SPECIFICATION" | "APPLICATION";
type MessageFilterParam = "all" | "not-read";

/**
 * Admin 대시보드 페이지
 */
export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: isAdmin } = useIsAdmin();
  const { data: currentProfile } = useCurrentProfile();
  // 전체 태스크 탭: 모든 태스크 조회 (승인됨 제외)
  const { data: allTasksRaw = [], isLoading: allTasksLoading } = useTasksForAdmin(false);
  const allTasks = useMemo(() => 
    allTasksRaw.filter((task) => task.task_status !== "APPROVED"), 
    [allTasksRaw]
  );
  // 승인된 태스크 탭: 모든 사용자의 승인된 태스크만 (자기 할당 Task 제외)
  // Admin이 참조자인 Task는 isReferencedTask 플래그로 표시 (초록 배경용)
  const approvedTasks = useMemo(() => {
    const filtered = allTasksRaw.filter(
      (task) => task.task_status === "APPROVED" && task.is_self_task === false,
    );
    return filtered.map((task) => ({
      ...task,
      isReferencedTask: currentProfile?.id
        ? task.references?.some((ref) => ref.id === currentProfile.id)
        : false,
    }));
  }, [allTasksRaw, currentProfile?.id]);
  // 담당 업무 탭: 지시자/담당자인 태스크 중 승인됨이 아닌 것만
  const { data: myTasks = [], isLoading: myTasksLoading } = useTasksForMember(true);
  // 개인 태스크 탭: 자기 할당 Task만 조회
  const { data: selfTasksRaw = [], isLoading: selfTasksLoading } = useSelfTasks(false);
  const selfTasks = useMemo(() => selfTasksRaw, [selfTasksRaw]);
  // 참조된 업무 탭: 참조자로 지정된 Task만 조회
  const { data: referenceTasksRaw = [], isLoading: referenceTasksLoading } = useTasksAsReference();
  const referenceTasks = useMemo(
    () => referenceTasksRaw.filter((task) => task.task_status !== "APPROVED"),
    [referenceTasksRaw],
  );
  const updateTaskStatus = useUpdateTaskStatus();
  const updateTask = useUpdateTask();
  const createTask = useCreateTask();
  const createMessageWithFiles = useCreateMessageWithFiles();
  const [searchParams, setSearchParams] = useSearchParams();

  // 탭 상태 - URL 쿼리 파라미터에서 읽기
  const tabParam = searchParams.get("tab") as DashboardTab | null;
  const [activeTab, setActiveTab] = useState<DashboardTab>(
    tabParam === "all-tasks" || tabParam === "my-tasks" || tabParam === "approved-tasks" || tabParam === "self-tasks" || tabParam === "reference-tasks" ? tabParam : "my-tasks",
  );

  // URL params 읽기 (전체 태스크 탭 및 담당 업무 탭용)
  const currentTabFromUrl = searchParams.get("tab") as DashboardTab | null;

  // 검색어는 URL params에서 읽기
  const keywordParam = searchParams.get("keyword");
  const [searchQuery, setSearchQuery] = useState(keywordParam || "");

  const sortDueParam = searchParams.get("sortDue") as SortDueParam | null;
  // 승인된 태스크 탭(approved-tasks): 생성일 기본 내림차순(최신순), 그 외 탭: 마감일 기본 오름차순
  const sortDue: SortDueParam =
    sortDueParam === "asc" || sortDueParam === "desc"
      ? sortDueParam
      : tabParam === "approved-tasks"
        ? "desc"
        : "asc";

  const sortEmailSentParam = searchParams.get("sortEmailSent") as SortEmailSentParam | null;
  const sortEmailSent: SortEmailSentParam =
    sortEmailSentParam === "asc" || sortEmailSentParam === "desc" ? sortEmailSentParam : "asc";

  const emailSentParam = searchParams.get("emailSent") as EmailSentParam | null;
  const validEmailSentParams: EmailSentParam[] = ["all", "sent", "not_sent"];
  const emailSent: EmailSentParam =
    emailSentParam && validEmailSentParams.includes(emailSentParam) ? emailSentParam : "all";

  const categoryParam = searchParams.get("category") as CategoryParam | null;
  const validCategoryParams: CategoryParam[] = ["all", "REVIEW", "REVISION", "CONTRACT", "SPECIFICATION", "APPLICATION"];
  const category: CategoryParam =
    categoryParam && validCategoryParams.includes(categoryParam) ? categoryParam : "all";

  // 참조된 업무 탭용 카테고리/상태 (탭 전환 시 독립 유지)
  const referenceCategoryParam = searchParams.get("referenceCategory") as CategoryParam | null;
  const referenceCategory: CategoryParam =
    referenceCategoryParam && validCategoryParams.includes(referenceCategoryParam) ? referenceCategoryParam : "all";
  const referenceStatusParam = searchParams.get("referenceStatus") as StatusParam | null;
  const validReferenceStatusParams: StatusParam[] = ["all", "assigned", "in_progress", "waiting_confirm", "rejected"];
  const referenceStatus: StatusParam =
    referenceStatusParam && validReferenceStatusParams.includes(referenceStatusParam) ? referenceStatusParam : "all";

  const statusParam = searchParams.get("status") as StatusParam | null;
  // 전체 태스크 탭에서는 승인됨 제외, 다른 탭에서는 승인됨 포함
  const validStatusParamsForAllTasks: StatusParam[] = [
    "all",
    "assigned",
    "in_progress",
    "waiting_confirm",
    "rejected",
  ];
  const validStatusParams: StatusParam[] = [
    "all",
    "assigned",
    "in_progress",
    "waiting_confirm",
    "rejected",
    "approved",
  ];
  // 현재 탭에 따라 유효한 상태 파라미터 결정 (tabParam 사용하여 초기화 순서 문제 방지)
  const currentTabForStatus = tabParam === "all-tasks" || tabParam === "my-tasks" || tabParam === "approved-tasks" ? tabParam : "my-tasks";
  const currentValidStatusParams = currentTabForStatus === "all-tasks" ? validStatusParamsForAllTasks : validStatusParams;
  const status: StatusParam =
    statusParam && currentValidStatusParams.includes(statusParam) ? statusParam : "all";

  // 안 읽은 메시지 필터 파라미터 (개인 태스크 탭 제외)
  const messageFilterParam = searchParams.get("message") as MessageFilterParam | null;
  const validMessageFilterParams: MessageFilterParam[] = ["all", "not-read"];
  const messageFilter: MessageFilterParam =
    messageFilterParam && validMessageFilterParams.includes(messageFilterParam) ? messageFilterParam : "all";

  // 다이얼로그 상태
  const [createTaskDialogOpen, setCreateTaskDialogOpen] = useState(false);
  const [statusChangeDialogOpen, setStatusChangeDialogOpen] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    taskId: string;
    currentStatus: TaskStatus;
    newStatus: TaskStatus;
    taskTitle: string;
  } | null>(null);

  // 빠른 생성 관련 상태
  const [preSelectedCategory, setPreSelectedCategory] = useState<
    "REVIEW" | "REVISION" | "CONTRACT" | "SPECIFICATION" | "APPLICATION" | undefined
  >(undefined);
  const [autoFillMode, setAutoFillMode] = useState<
    "REVIEW" | "REVISION" | "CONTRACT" | "SPECIFICATION" | "APPLICATION" | undefined
  >(undefined);
  const [preFilledTitle, setPreFilledTitle] = useState<string | undefined>(undefined);
  const [isSpecificationMode, setIsSpecificationMode] = useState(false);
  // Task 생성 중 상태 (중복 클릭 방지)
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  // 페이지네이션 상태 (전체 태스크 탭용)
  const allTasksPageParam = searchParams.get("allTasksPage");
  const allTasksCurrentPage = allTasksPageParam ? Math.max(1, parseInt(allTasksPageParam, 10)) : 1;
  const [allTasksItemsPerPage, setAllTasksItemsPerPage] = useState(() => {
    const saved = sessionStorage.getItem("tablePageSize");
    return saved ? parseInt(saved, 10) : 10;
  });

  // 페이지네이션 상태 (담당 업무 탭용) - URL에서 직접 읽기 (다른 파라미터들과 동일한 방식)
  const myTasksPageParam = searchParams.get("myTasksPage");
  const myTasksCurrentPage = myTasksPageParam ? Math.max(1, parseInt(myTasksPageParam, 10)) : 1;
  const [myTasksItemsPerPage, setMyTasksItemsPerPage] = useState(() => {
    const saved = sessionStorage.getItem("tablePageSize");
    return saved ? parseInt(saved, 10) : 10;
  });

  // 페이지네이션 상태 (승인된 태스크 탭용)
  const approvedTasksPageParam = searchParams.get("approvedTasksPage");
  const approvedTasksCurrentPage = approvedTasksPageParam ? Math.max(1, parseInt(approvedTasksPageParam, 10)) : 1;
  const [approvedTasksItemsPerPage, setApprovedTasksItemsPerPage] = useState(() => {
    const saved = sessionStorage.getItem("tablePageSize");
    return saved ? parseInt(saved, 10) : 10;
  });

  // 페이지네이션 상태 (개인 태스크 탭용)
  const selfTasksPageParam = searchParams.get("selfTasksPage");
  const selfTasksCurrentPage = selfTasksPageParam ? Math.max(1, parseInt(selfTasksPageParam, 10)) : 1;
  const [selfTasksItemsPerPage, setSelfTasksItemsPerPage] = useState(() => {
    const saved = sessionStorage.getItem("tablePageSize");
    return saved ? parseInt(saved, 10) : 10;
  });

  // 페이지네이션 상태 (참조된 업무 탭용)
  const referenceTasksPageParam = searchParams.get("referenceTasksPage");
  const referenceTasksCurrentPage = referenceTasksPageParam ? Math.max(1, parseInt(referenceTasksPageParam, 10)) : 1;
  const [referenceTasksItemsPerPage, setReferenceTasksItemsPerPage] = useState(() => {
    const saved = sessionStorage.getItem("tablePageSize");
    return saved ? parseInt(saved, 10) : 10;
  });

  // 검색어 debounce
  const debouncedSearch = useDebounce(searchQuery, 300);

  // 마운트 여부 및 이전 필터 값 추적 (페이지 리셋 조건 판단용)
  const isFirstRenderRef = useRef(true);
  const prevAllTasksFiltersRef = useRef<{ search: string; category: CategoryParam; status: StatusParam; sortDue: SortDueParam }>({ search: "", category: "all", status: "all", sortDue: "asc" });
  const prevMyTasksFiltersRef = useRef<{ search: string; category: CategoryParam; status: StatusParam; sortDue: SortDueParam }>({ search: "", category: "all", status: "all", sortDue: "asc" });
  const prevApprovedTasksFiltersRef = useRef<{ search: string; category: CategoryParam; sortDue: SortDueParam; sortEmailSent: SortEmailSentParam; emailSent: EmailSentParam }>({ search: "", category: "all", sortDue: "desc", sortEmailSent: "asc", emailSent: "all" });
  const prevSelfTasksFiltersRef = useRef<{ search: string; category: CategoryParam; status: StatusParam; sortDue: SortDueParam; emailSent: EmailSentParam }>({ search: "", category: "all", status: "all", sortDue: "asc", emailSent: "all" });

  // 대시보드 페이지에 있을 때 현재 URL을 세션 스토리지에 저장
  useEffect(() => {
    const currentUrl = location.pathname + location.search;
    if (currentUrl === "/" || currentUrl.startsWith("/?")) {
      sessionStorage.setItem("previousDashboardUrl", currentUrl);
    }
  }, [location.pathname, location.search]);


  // URL params 업데이트 헬퍼 함수 (전체 태스크 탭용)
  const updateAllTasksUrlParams = (
    updates?: Partial<{
      sortDue: SortDueParam;
      category: CategoryParam;
      status: StatusParam;
      message?: MessageFilterParam;
      keyword?: string;
      allTasksPage?: number;
    }>,
  ) => {
    const newParams = new URLSearchParams();

    // tab 파라미터 설정 (항상 설정)
    newParams.set("tab", "all-tasks");

    // 업데이트가 제공되면 해당 값 사용, 없으면 현재 URL에서 읽은 값 사용
    const sortDueToSet = updates?.sortDue !== undefined ? updates.sortDue : sortDue;
    const categoryToSet = updates?.category !== undefined ? updates.category : category;
    const statusToSet = updates?.status !== undefined ? updates.status : status;
    const messageToSet = updates?.message !== undefined ? updates.message : messageFilter;
    const keywordToSet = updates?.keyword !== undefined ? updates.keyword : searchQuery;
    const allTasksPageToSet = updates?.allTasksPage !== undefined ? updates.allTasksPage : allTasksCurrentPage;

    // sortDue 설정
    if (sortDueToSet !== "asc") {
      newParams.set("sortDue", sortDueToSet);
    }

    // category 설정
    if (categoryToSet !== "all") {
      newParams.set("category", categoryToSet);
    }

    // status 설정
    if (statusToSet !== "all") {
      newParams.set("status", statusToSet);
    }

    // message 설정
    if (messageToSet !== "all") {
      newParams.set("message", messageToSet);
    }

    // keyword 설정
    if (keywordToSet && keywordToSet.trim()) {
      newParams.set("keyword", keywordToSet);
    }

    // allTasksPage 설정
    if (allTasksPageToSet !== undefined && allTasksPageToSet !== 1) {
      newParams.set("allTasksPage", allTasksPageToSet.toString());
    }

    setSearchParams(newParams, { replace: true });
  };

  // URL params 업데이트 헬퍼 함수 (담당 업무 탭용)
  const updateMyTasksUrlParams = (
    updates?: Partial<{
      sortDue: SortDueParam;
      category: CategoryParam;
      status: StatusParam;
      message?: MessageFilterParam;
      keyword?: string;
      myTasksPage?: number;
    }>,
  ) => {
    const newParams = new URLSearchParams();

    // tab 파라미터 설정 (항상 설정)
    newParams.set("tab", "my-tasks");

    // 업데이트가 제공되면 해당 값 사용, 없으면 현재 URL에서 읽은 값 사용
    const sortDueToSet = updates?.sortDue !== undefined ? updates.sortDue : sortDue;
    const categoryToSet = updates?.category !== undefined ? updates.category : category;
    const statusToSet = updates?.status !== undefined ? updates.status : status;
    const messageToSet = updates?.message !== undefined ? updates.message : messageFilter;
    const keywordToSet = updates?.keyword !== undefined ? updates.keyword : searchQuery;
    const myTasksPageToSet = updates?.myTasksPage !== undefined ? updates.myTasksPage : myTasksCurrentPage;

    // sortDue 설정
    if (sortDueToSet !== "asc") {
      newParams.set("sortDue", sortDueToSet);
    }

    // category 설정
    if (categoryToSet !== "all") {
      newParams.set("category", categoryToSet);
    }

    // status 설정
    if (statusToSet !== "all") {
      newParams.set("status", statusToSet);
    }

    // message 설정
    if (messageToSet !== "all") {
      newParams.set("message", messageToSet);
    }

    // keyword 설정
    if (keywordToSet && keywordToSet.trim()) {
      newParams.set("keyword", keywordToSet);
    }

    // myTasksPage 설정
    if (myTasksPageToSet !== undefined && myTasksPageToSet !== 1) {
      newParams.set("myTasksPage", myTasksPageToSet.toString());
    }

    setSearchParams(newParams, { replace: true });
  };

  // URL params 업데이트 헬퍼 함수 (개인 태스크 탭용)
  const updateSelfTasksUrlParams = (
    updates?: Partial<{
      sortDue: SortDueParam;
      category: CategoryParam;
      status: StatusParam;
      emailSent: EmailSentParam;
      keyword?: string;
      selfTasksPage?: number;
    }>,
  ) => {
    const newParams = new URLSearchParams();

    // tab 파라미터 설정 (항상 설정)
    newParams.set("tab", "self-tasks");

    // 업데이트가 제공되면 해당 값 사용, 없으면 현재 URL에서 읽은 값 사용
    const sortDueToSet = updates?.sortDue !== undefined ? updates.sortDue : sortDue;
    const categoryToSet = updates?.category !== undefined ? updates.category : category;
    const statusToSet = updates?.status !== undefined ? updates.status : status;
    const emailSentToSet = updates?.emailSent !== undefined ? updates.emailSent : emailSent;
    const keywordToSet = updates?.keyword !== undefined ? updates.keyword : searchQuery;
    const selfTasksPageToSet = updates?.selfTasksPage !== undefined ? updates.selfTasksPage : selfTasksCurrentPage;

    // sortDue 설정
    if (sortDueToSet !== "asc") {
      newParams.set("sortDue", sortDueToSet);
    }

    // category 설정
    if (categoryToSet !== "all") {
      newParams.set("category", categoryToSet);
    }

    // status 설정
    if (statusToSet !== "all") {
      newParams.set("status", statusToSet);
    }

    // emailSent 설정
    if (emailSentToSet && emailSentToSet !== "all") {
      newParams.set("emailSent", emailSentToSet);
    }

    // keyword 설정
    if (keywordToSet && keywordToSet.trim()) {
      newParams.set("keyword", keywordToSet);
    }

    // selfTasksPage 설정
    if (selfTasksPageToSet !== undefined && selfTasksPageToSet !== 1) {
      newParams.set("selfTasksPage", selfTasksPageToSet.toString());
    }

    setSearchParams(newParams, { replace: true });
  };

  // URL params 업데이트 헬퍼 함수 (승인된 태스크 탭용)
  const updateApprovedTasksUrlParams = (
    updates?: Partial<{
      sortDue: SortDueParam;
      sortEmailSent: SortEmailSentParam;
      category: CategoryParam;
      emailSent: EmailSentParam;
      message?: MessageFilterParam;
      keyword?: string;
      approvedTasksPage?: number;
    }>,
  ) => {
    const newParams = new URLSearchParams();

    // tab 파라미터 설정 (항상 설정)
    newParams.set("tab", "approved-tasks");

    // 업데이트가 제공되면 해당 값 사용, 없으면 현재 URL에서 읽은 값 사용
    const sortDueToSet = updates?.sortDue !== undefined ? updates.sortDue : sortDue;
    const sortEmailSentToSet = updates?.sortEmailSent !== undefined ? updates.sortEmailSent : sortEmailSent;
    const categoryToSet = updates?.category !== undefined ? updates.category : category;
    const emailSentToSet = updates?.emailSent !== undefined ? updates.emailSent : emailSent;
    const messageToSet = updates?.message !== undefined ? updates.message : messageFilter;
    const keywordToSet = updates?.keyword !== undefined ? updates.keyword : searchQuery;
    const approvedTasksPageToSet = updates?.approvedTasksPage !== undefined ? updates.approvedTasksPage : approvedTasksCurrentPage;

    // sortDue 설정 (승인된 태스크 탭 기본값: desc, asc일 때만 URL에 추가)
    if (sortDueToSet !== "desc") {
      newParams.set("sortDue", sortDueToSet);
    }

    // sortEmailSent 설정
    if (sortEmailSentToSet !== "asc") {
      newParams.set("sortEmailSent", sortEmailSentToSet);
    }

    // category 설정
    if (categoryToSet !== "all") {
      newParams.set("category", categoryToSet);
    }

    // emailSent 설정
    if (emailSentToSet !== "all") {
      newParams.set("emailSent", emailSentToSet);
    }

    // message 설정
    if (messageToSet !== "all") {
      newParams.set("message", messageToSet);
    }

    // keyword 설정
    if (keywordToSet && keywordToSet.trim()) {
      newParams.set("keyword", keywordToSet);
    }

    // approvedTasksPage 설정
    if (approvedTasksPageToSet !== undefined && approvedTasksPageToSet !== 1) {
      newParams.set("approvedTasksPage", approvedTasksPageToSet.toString());
    }

    setSearchParams(newParams, { replace: true });
  };

  // URL params 업데이트 헬퍼 함수 (참조된 업무 탭용)
  const updateReferenceTasksUrlParams = (
    updates?: Partial<{
      keyword?: string;
      referenceTasksPage?: number;
      sortDue?: SortDueParam;
      referenceCategory?: CategoryParam;
      referenceStatus?: StatusParam;
      message?: MessageFilterParam;
    }>,
  ) => {
    const newParams = new URLSearchParams();
    newParams.set("tab", "reference-tasks");
    const keywordToSet = updates?.keyword !== undefined ? updates.keyword : searchQuery;
    const referenceTasksPageToSet = updates?.referenceTasksPage !== undefined ? updates.referenceTasksPage : referenceTasksCurrentPage;
    const sortDueToSet = updates?.sortDue !== undefined ? updates.sortDue : sortDue;
    const referenceCategoryToSet = updates?.referenceCategory !== undefined ? updates.referenceCategory : referenceCategory;
    const referenceStatusToSet = updates?.referenceStatus !== undefined ? updates.referenceStatus : referenceStatus;
    const messageToSet = updates?.message !== undefined ? updates.message : messageFilter;
    if (keywordToSet && keywordToSet.trim()) {
      newParams.set("keyword", keywordToSet);
    }
    if (referenceTasksPageToSet !== undefined && referenceTasksPageToSet !== 1) {
      newParams.set("referenceTasksPage", referenceTasksPageToSet.toString());
    }
    if (sortDueToSet !== "asc") {
      newParams.set("sortDue", sortDueToSet);
    }
    if (referenceCategoryToSet !== "all") {
      newParams.set("referenceCategory", referenceCategoryToSet);
    }
    if (referenceStatusToSet !== "all") {
      newParams.set("referenceStatus", referenceStatusToSet);
    }
    if (messageToSet !== "all") {
      newParams.set("message", messageToSet);
    }
    setSearchParams(newParams, { replace: true });
  };

  // 검색어 변경 핸들러 (로컬 state 및 URL params 업데이트)
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    // 현재 활성 탭에 따라 URL params 업데이트
    if (activeTab === "all-tasks") {
      updateAllTasksUrlParams({ keyword: value });
    } else if (activeTab === "approved-tasks") {
      updateApprovedTasksUrlParams({ keyword: value });
    } else if (activeTab === "reference-tasks") {
      updateReferenceTasksUrlParams({ keyword: value, referenceTasksPage: 1 });
    } else if (activeTab === "self-tasks") {
      updateSelfTasksUrlParams({ keyword: value });
    } else {
      updateMyTasksUrlParams({ keyword: value });
    }
  };

  // 안 읽은 메시지 필터 변경 핸들러
  const handleMessageFilterChange = (newMessageFilter: MessageFilterParam) => {
    if (activeTab === "all-tasks") {
      updateAllTasksUrlParams({ message: newMessageFilter, allTasksPage: 1 });
    } else if (activeTab === "approved-tasks") {
      updateApprovedTasksUrlParams({ message: newMessageFilter, approvedTasksPage: 1 });
    } else if (activeTab === "reference-tasks") {
      updateReferenceTasksUrlParams({ message: newMessageFilter, referenceTasksPage: 1 });
    } else if (activeTab === "my-tasks") {
      updateMyTasksUrlParams({ message: newMessageFilter, myTasksPage: 1 });
    }
    // self-tasks는 제외
  };

  // 정렬 변경 핸들러 (전체 태스크 탭용)
  const handleAllTasksSortDueChange = () => {
    const newSortDue: SortDueParam = sortDue === "asc" ? "desc" : "asc";
    updateAllTasksUrlParams({ sortDue: newSortDue });
  };

  // 정렬 변경 핸들러 (담당 업무 탭용)
  const handleMyTasksSortDueChange = () => {
    const newSortDue: SortDueParam = sortDue === "asc" ? "desc" : "asc";
    updateMyTasksUrlParams({ sortDue: newSortDue });
  };

  // 정렬 변경 핸들러 (승인된 태스크 탭용)
  const handleApprovedTasksSortDueChange = () => {
    const newSortDue: SortDueParam = sortDue === "asc" ? "desc" : "asc";
    updateApprovedTasksUrlParams({ sortDue: newSortDue });
  };

  // 정렬 변경 핸들러 (개인 태스크 탭용)
  const handleSelfTasksSortDueChange = () => {
    const newSortDue: SortDueParam = sortDue === "asc" ? "desc" : "asc";
    updateSelfTasksUrlParams({ sortDue: newSortDue });
  };

  // 카테고리 필터 변경 핸들러 (전체 태스크 탭용)
  const handleAllTasksCategoryChange = (newCategory: CategoryParam) => {
    updateAllTasksUrlParams({ category: newCategory });
  };

  // 카테고리 필터 변경 핸들러 (담당 업무 탭용)
  const handleMyTasksCategoryChange = (newCategory: CategoryParam) => {
    updateMyTasksUrlParams({ category: newCategory });
  };

  // 카테고리 필터 변경 핸들러 (승인된 태스크 탭용)
  const handleApprovedTasksCategoryChange = (newCategory: CategoryParam) => {
    updateApprovedTasksUrlParams({ category: newCategory });
  };

  // 카테고리 필터 변경 핸들러 (개인 태스크 탭용)
  const handleSelfTasksCategoryChange = (newCategory: CategoryParam) => {
    updateSelfTasksUrlParams({ category: newCategory });
  };

  // 상태 필터 변경 핸들러 (개인 태스크 탭용)
  const handleSelfTasksStatusChange = (newStatus: StatusParam) => {
    updateSelfTasksUrlParams({ status: newStatus });
  };

  // 이메일 발송 필터 변경 핸들러 (개인 태스크 탭용)
  const handleSelfTasksEmailSentChange = (newEmailSent: EmailSentParam) => {
    updateSelfTasksUrlParams({ emailSent: newEmailSent });
  };

  // 이메일 발송 필터 변경 핸들러 (승인된 태스크 탭용)
  const handleApprovedTasksEmailSentChange = (newEmailSent: EmailSentParam) => {
    updateApprovedTasksUrlParams({ emailSent: newEmailSent });
  };

  // 상태 필터 변경 핸들러 (전체 태스크 탭용)
  const handleAllTasksStatusChange = (newStatus: StatusParam) => {
    updateAllTasksUrlParams({ status: newStatus });
  };

  // 상태 필터 변경 핸들러 (담당 업무 탭용)
  const handleMyTasksStatusChange = (newStatus: StatusParam) => {
    updateMyTasksUrlParams({ status: newStatus });
  };

  // 카테고리 필터 변경 핸들러 (참조된 업무 탭용)
  const handleReferenceTasksCategoryChange = (newCategory: CategoryParam) => {
    updateReferenceTasksUrlParams({ referenceCategory: newCategory, referenceTasksPage: 1 });
  };

  // 상태 필터 변경 핸들러 (참조된 업무 탭용)
  const handleReferenceTasksStatusChange = (newStatus: StatusParam) => {
    updateReferenceTasksUrlParams({ referenceStatus: newStatus, referenceTasksPage: 1 });
  };

  // Task 상태 변경 핸들러
  const handleTaskStatusChange = (taskId: string, newStatus: TaskStatus) => {
    let task: TaskWithProfiles | undefined;
    if (activeTab === "all-tasks") {
      task = allTasks.find((t) => t.id === taskId);
    } else if (activeTab === "approved-tasks") {
      task = approvedTasks.find((t) => t.id === taskId);
    } else if (activeTab === "self-tasks") {
      task = selfTasks.find((t) => t.id === taskId);
    } else {
      task = myTasks.find((t) => t.id === taskId);
    }
    if (task) {
      setPendingStatusChange({
        taskId,
        currentStatus: task.task_status,
        newStatus,
        taskTitle: task.title,
      });
      setStatusChangeDialogOpen(true);
    }
  };

  // 상태 변경 확인 핸들러
  // 고객에게 이메일 발송 완료 상태 토글 핸들러
  const handleEmailSentToggle = async (task: TaskWithProfiles, e: React.MouseEvent) => {
    e.stopPropagation(); // 행 클릭 이벤트 차단
    
    // 담당자 또는 참조자 권한 확인
    const isAssignee = task.assignee_id === currentProfile?.id;
    const isReference = task.references?.some((ref) => ref.id === currentProfile?.id) ?? false;
    
    if (!isAssignee && !isReference) {
      toast.error("고객에게 이메일 발송 완료 상태는 담당자 또는 참조자만 변경할 수 있습니다.");
      return;
    }
    
    try {
      await updateTask.mutateAsync({
        id: task.id,
        updates: {
          send_email_to_client: !task.send_email_to_client,
        },
      });
    } catch (error) {
      // 에러는 훅에서 이미 처리됨
    }
  };

  const handleConfirmStatusChange = async () => {
    if (!pendingStatusChange) return;

    try {
      await updateTaskStatus.mutateAsync({
        taskId: pendingStatusChange.taskId,
        newStatus: pendingStatusChange.newStatus,
      });
      setStatusChangeDialogOpen(false);
      setPendingStatusChange(null);
    } catch (error) {
      toast.error("상태 변경에 실패했습니다.");
    }
  };

  // 빠른 생성 핸들러
  const handleQuickCreate = (
    category: "REVIEW" | "REVISION" | "CONTRACT" | "SPECIFICATION" | "APPLICATION",
    title?: string,
  ) => {
    setPreSelectedCategory(category);
    setAutoFillMode(category);

    if (category === "SPECIFICATION") {
      // 명세서 모드: 2개 Task 자동 생성
      setPreFilledTitle(undefined);
      setIsSpecificationMode(true);
    } else {
      // 일반 모드: 제목 자동 입력
      setPreFilledTitle(title);
      setIsSpecificationMode(false);
    }

    setCreateTaskDialogOpen(true);
  };

  // 명세서 모드 핸들러 (2개 Task 자동 생성)
  const handleCreateSpecificationTasks = async (
    assigneeId: string,
    clientName: string,
    dueDateClaimDrawing: string,
    dueDateDraft: string,
    files?: File[],
    notes?: string,
    referenceIds?: string[],
  ) => {
    if (!currentProfile?.id) return;

    try {
      // 폼에서 받은 마감일 사용
      const dueDate1Str = dueDateClaimDrawing;
      const dueDate2Str = dueDateDraft;

      const refIds = referenceIds?.filter((id) => id !== assigneeId) ?? [];

      // Task 1 생성
      const task1 = await createTask.mutateAsync({
        title: "청구항 및 도면",
        assignee_id: assigneeId,
        due_date: dueDate1Str,
        task_category: "SPECIFICATION",
        client_name: clientName,
        reference_ids: refIds,
      });

      // Task 2 생성
      const task2 = await createTask.mutateAsync({
        title: "초안 작성",
        assignee_id: assigneeId,
        due_date: dueDate2Str,
        task_category: "SPECIFICATION",
        client_name: clientName,
        reference_ids: refIds,
      });

      // 각 Task에 특이사항/파일 메시지 생성
      const createMessagesForTask = async (taskId: string, assignerId: string) => {
        const hasNotes = notes && notes.trim().length > 0;
        const hasFiles = files && files.length > 0;

        if (hasNotes || hasFiles) {
          const uploadedFiles: Array<{
            url: string;
            fileName: string;
            fileType: string;
            fileSize: number;
          }> = [];

          if (hasFiles) {
            for (const file of files) {
              try {
                const fileInfo = await uploadTaskFile(file, taskId, assignerId);
                uploadedFiles.push(fileInfo);
              } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : String(error);
                toast.error(`${file.name} 업로드 실패: ${msg}`);
              }
            }
          }

          if (hasNotes || uploadedFiles.length > 0) {
            const bundleId = uploadedFiles.length > 0 ? crypto.randomUUID() : undefined;
            await createMessageWithFiles.mutateAsync({
              taskId,
              content: hasNotes ? notes.trim() : null,
              files: uploadedFiles,
              bundleId,
            });
          }
        }
      };

      await createMessagesForTask(task1.id, currentProfile.id);
      await createMessagesForTask(task2.id, currentProfile.id);

      // 마감일 초과 여부 확인 및 알림 표시 (각 Task별로 확인)
      try {
        const result1 = await checkDueDateExceeded(task1.id, dueDate1Str);
        if (result1.exceeded && result1.scheduleDate) {
          const dueDateFormatted = formatDateKorean(result1.dueDate);
          const scheduleDateFormatted = formatDateKorean(result1.scheduleDate);
          
          // 주말 때문에 늦게 배정되었는지 확인
          const hasWeekend = hasWeekendBetween(task1.created_at, result1.scheduleDate);
          
          if (hasWeekend) {
            // 주말 제외 및 일정 사정으로 늦게 배정된 경우 (통합 메시지)
            toast.warning(
              `주말 제외 및 일정 사정으로 "청구항 및 도면" 업무가 마감일(${dueDateFormatted})보다 늦은 ${scheduleDateFormatted}에 일정이 배정되었습니다.`,
              {
                position: "bottom-right",
                duration: 8000,
              }
            );
          } else {
            // 일정이 가득 차서 다른 날짜에 배정된 경우
            toast.warning(
              `담당자의 퇴근시간이 임박했거나 일정이 가득 차 있어 "청구항 및 도면" 업무가 마감일(${dueDateFormatted})보다 늦은 ${scheduleDateFormatted}에 일정이 배정되었습니다.`,
              {
                position: "bottom-right",
                duration: 8000,
              }
            );
          }
        } else if (result1.scheduleDate) {
          // 마감일 이내지만 주말 때문에 늦게 배정된 경우
          const hasWeekend = hasWeekendBetween(task1.created_at, result1.scheduleDate);
          
          if (hasWeekend) {
            const scheduleDateFormatted = formatDateKorean(result1.scheduleDate);
            toast.info(
              `주말을 제외하여 "청구항 및 도면" 업무가 ${scheduleDateFormatted}에 일정이 배정되었습니다.`,
              {
                position: "bottom-right",
                duration: 6000,
              }
            );
          }
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("마감일 체크 실패 (Task 1):", msg);
      }

      try {
        const result2 = await checkDueDateExceeded(task2.id, dueDate2Str);
        if (result2.exceeded && result2.scheduleDate) {
          const dueDateFormatted = formatDateKorean(result2.dueDate);
          const scheduleDateFormatted = formatDateKorean(result2.scheduleDate);
          
          // 주말 때문에 늦게 배정되었는지 확인
          const hasWeekend = hasWeekendBetween(task2.created_at, result2.scheduleDate);
          
          if (hasWeekend) {
            // 주말 제외 및 일정 사정으로 늦게 배정된 경우 (통합 메시지)
            toast.warning(
              `주말 제외 및 일정 사정으로 "초안 작성" 업무가 마감일(${dueDateFormatted})보다 늦은 ${scheduleDateFormatted}에 일정이 배정되었습니다.`,
              {
                position: "bottom-right",
                duration: 8000,
              }
            );
          } else {
            // 일정이 가득 차서 다른 날짜에 배정된 경우
            toast.warning(
              `담당자의 퇴근시간이 임박했거나 일정이 가득 차 있어 "초안 작성" 업무가 마감일(${dueDateFormatted})보다 늦은 ${scheduleDateFormatted}에 일정이 배정되었습니다.`,
              {
                position: "bottom-right",
                duration: 8000,
              }
            );
          }
        } else if (result2.scheduleDate) {
          // 마감일 이내지만 주말 때문에 늦게 배정된 경우
          const hasWeekend = hasWeekendBetween(task2.created_at, result2.scheduleDate);
          
          if (hasWeekend) {
            const scheduleDateFormatted = formatDateKorean(result2.scheduleDate);
            toast.info(
              `주말을 제외하여 "초안 작성" 업무가 ${scheduleDateFormatted}에 일정이 배정되었습니다.`,
              {
                position: "bottom-right",
                duration: 6000,
              }
            );
          }
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("마감일 체크 실패 (Task 2):", msg);
      }

      setCreateTaskDialogOpen(false);
      setIsSpecificationMode(false);
      setPreSelectedCategory(undefined);
      setAutoFillMode(undefined);
      setPreFilledTitle(undefined);

      // 명세서 Task 생성 완료: 새 탭 2개 열기
      // 브라우저 팝업 차단을 피하기 위해 사용자 상호작용 컨텍스트 내에서 동기적으로 연속으로 열기
      // 비동기 함수(setTimeout, requestAnimationFrame 등)를 사용하면 사용자 상호작용 컨텍스트가 끊겨서 차단될 수 있음
      const tab1 = window.open(`/tasks/${task1.id}`, "_blank");
      const tab2 = window.open(`/tasks/${task2.id}`, "_blank");
      
      // 탭이 차단되었는지 확인
      if (!tab1 || tab1.closed || typeof tab1.closed === "undefined") {
        toast.info("첫 번째 업무 상세 페이지를 새 탭에서 열 수 없습니다. 직접 이동해주세요.");
      }
      if (!tab2 || tab2.closed || typeof tab2.closed === "undefined") {
        toast.info("두 번째 업무 상세 페이지를 새 탭에서 열 수 없습니다. 직접 이동해주세요.");
      }

      toast.success("명세서 업무 2개가 생성되었습니다.");
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(`명세서 업무 생성 중 오류가 발생했습니다: ${msg}`);
    }
  };

  // 태스크 생성 핸들러
  const handleCreateTask = async (
    data: TaskCreateFormData | TaskCreateSelfTaskFormData | TaskCreateSpecificationFormData | TaskUpdateFormData,
    files?: File[],
    notes?: string,
  ) => {
    // 이미 생성 중이면 중복 실행 방지
    if (isCreatingTask) {
      return;
    }

    // 명세서 모드인 경우 별도 처리
    if (isSpecificationMode) {
      const specificationData = data as TaskCreateSpecificationFormData;
      if (!specificationData.client_name || specificationData.client_name.trim() === "") {
        toast.error("고객명을 입력해주세요.");
        return;
      }
      if (!specificationData.due_date_claim_drawing || !specificationData.due_date_draft) {
        toast.error("마감일을 모두 입력해주세요.");
        return;
      }
      setIsCreatingTask(true);
      try {
        await handleCreateSpecificationTasks(
          specificationData.assignee_id,
          specificationData.client_name,
          specificationData.due_date_claim_drawing,
          specificationData.due_date_draft,
          files,
          notes,
          specificationData.reference_ids,
        );
      } finally {
        setIsCreatingTask(false);
      }
      return;
    }

    setIsCreatingTask(true);
    try {
      // 1. 태스크 생성
      const isSelfTask = activeTab === "self-tasks";
      const createData = data as TaskCreateFormData | TaskCreateSelfTaskFormData;
      const referenceIds = (createData as TaskCreateFormData).reference_ids ?? [];
      const newTask = await createTask.mutateAsync({
        title: createData.title,
        assignee_id: isSelfTask ? undefined : (createData as TaskCreateFormData).assignee_id, // 자기 할당 Task는 assignee_id 불필요
        task_category: createData.task_category,
        client_name: createData.client_name || null,
        due_date: createData.due_date,
        is_self_task: isSelfTask, // 자기 할당 Task 플래그
        reference_ids: referenceIds.length > 0 ? referenceIds : undefined,
      });

      // 2. 파일이 있으면 업로드 후 메시지로 전송
      const uploadedFiles: Array<{
        url: string;
        fileName: string;
        fileType: string;
        fileSize: number;
      }> = [];

      if (files && files.length > 0 && currentProfile?.id) {
        for (const file of files) {
          try {
            const { url, fileName, fileType, fileSize } = await uploadTaskFile(
              file,
              newTask.id,
              currentProfile.id,
            );
            uploadedFiles.push({ url, fileName, fileType, fileSize });
          } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            toast.error(`${file.name} 업로드 실패: ${msg}`);
          }
        }
      }

      // 3. 특이사항이나 파일이 있으면 메시지로 전송
      if ((notes && notes.trim()) || uploadedFiles.length > 0) {
        const bundleId = uploadedFiles.length > 0 ? crypto.randomUUID() : undefined;
        await createMessageWithFiles.mutateAsync({
          taskId: newTask.id,
          content: notes && notes.trim() ? notes.trim() : null,
          files: uploadedFiles,
          bundleId,
        });
      }

      // 4. 마감일 초과 여부 확인 및 알림 표시 (Edge Function 사용)
      try {
        const result = await checkDueDateExceeded(newTask.id, createData.due_date);
        
        if (result.exceeded && result.scheduleDate) {
          const dueDateFormatted = formatDateKorean(result.dueDate);
          const scheduleDateFormatted = formatDateKorean(result.scheduleDate);
          
          // 주말 때문에 늦게 배정되었는지 확인
          const hasWeekend = hasWeekendBetween(newTask.created_at, result.scheduleDate);
          
          if (hasWeekend) {
            // 주말 제외 및 일정 사정으로 늦게 배정된 경우 (통합 메시지)
            toast.warning(
              `주말 제외 및 일정 사정으로 마감일(${dueDateFormatted})보다 늦은 ${scheduleDateFormatted}에 일정이 배정되었습니다.`,
              {
                position: "bottom-right",
                duration: 8000,
              }
            );
          } else {
            // 일정이 가득 차서 다른 날짜에 배정된 경우
            toast.warning(
              `담당자의 퇴근시간이 임박했거나 일정이 가득 차 있어 마감일(${dueDateFormatted})보다 늦은 ${scheduleDateFormatted}에 일정이 배정되었습니다.`,
              {
                position: "bottom-right",
                duration: 8000,
              }
            );
          }
        } else if (result.scheduleDate) {
          // 마감일 이내지만 주말 때문에 늦게 배정된 경우
          const hasWeekend = hasWeekendBetween(newTask.created_at, result.scheduleDate);
          
          if (hasWeekend) {
            const scheduleDateFormatted = formatDateKorean(result.scheduleDate);
            toast.info(
              `주말을 제외하여 ${scheduleDateFormatted}에 일정이 배정되었습니다.`,
              {
                position: "bottom-right",
                duration: 6000,
              }
            );
          }
        }
      } catch (error: unknown) {
        // 에러는 무시 (Task 생성 성공에 영향 없음)
        const msg = error instanceof Error ? error.message : String(error);
        console.error("[Task 생성] 마감일 체크 실패:", msg);
      }

      // 5. 다이얼로그 닫기 및 상태 초기화
      setCreateTaskDialogOpen(false);
      setPreSelectedCategory(undefined);
      setAutoFillMode(undefined);
      setPreFilledTitle(undefined);
      setIsSpecificationMode(false);

      // 6. 생성한 Task 상세 페이지로 이동 (동일 탭)
      navigate(`/tasks/${newTask.id}`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(msg || "태스크 생성에 실패했습니다.");
    } finally {
      setIsCreatingTask(false);
    }
  };


  // 상태 매핑 (URL → DB)
  const statusMap: Record<StatusParam, TaskStatus | null> = {
    all: null,
    assigned: "ASSIGNED",
    in_progress: "IN_PROGRESS",
    waiting_confirm: "WAITING_CONFIRM",
    rejected: "REJECTED",
    approved: "APPROVED",
  };

  // 전체 태스크 탭: 검색 필터링
  const searchedAllTasks = useMemo(() => {
    if (!debouncedSearch.trim()) return allTasks;

    const query = debouncedSearch.toLowerCase();
    return allTasks.filter((task) => {
      const titleMatch = task.title.toLowerCase().includes(query);
      const assigneeName = (task.assignee?.full_name || task.assignee?.email || "").toLowerCase();
      const assigneeMatch = assigneeName.includes(query);
      const assignerName = (task.assigner?.full_name || task.assigner?.email || "").toLowerCase();
      const assignerMatch = assignerName.includes(query);
      const clientNameMatch = (task.client_name || "").toLowerCase().includes(query);
      const uniqueIdMatch = task.id.slice(0, 8).toLowerCase().includes(query);

      return titleMatch || assigneeMatch || assignerMatch || clientNameMatch || uniqueIdMatch;
    });
  }, [allTasks, debouncedSearch]);

  // 전체 태스크 탭: 카테고리 필터링
  const categoryFilteredAllTasks = useMemo(() => {
    if (category === "all") {
      return searchedAllTasks;
    }
    return searchedAllTasks.filter((task) => task.task_category === category);
  }, [searchedAllTasks, category]);

  // 전체 태스크 탭: 상태 필터링
  const statusFilteredAllTasks = useMemo(() => {
    const dbStatus = statusMap[status];
    if (dbStatus === null) {
      return categoryFilteredAllTasks; // 전체 선택 시 모든 상태 표시
    }
    return categoryFilteredAllTasks.filter((task) => task.task_status === dbStatus);
  }, [categoryFilteredAllTasks, status, statusMap]);

  // 전체 태스크 탭: 안 읽은 메시지 필터링
  const unreadFilteredAllTasks = useMemo(() => {
    if (messageFilter === "all") {
      return statusFilteredAllTasks;
    }
    return statusFilteredAllTasks.filter(
      (task) => task.unread_message_count && task.unread_message_count > 0
    );
  }, [statusFilteredAllTasks, messageFilter]);

  // 전체 태스크 탭: 정렬
  const sortedAllTasks = useMemo(() => {
    const sorted = [...unreadFilteredAllTasks];

    sorted.sort((a, b) => {
      if (sortDue === "asc") {
        // 마감일 빠른 순: 마감일이 없는 Task는 뒤로
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      } else {
        // 마감일 느린 순: 마감일이 없는 Task는 뒤로
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(b.due_date).getTime() - new Date(a.due_date).getTime();
      }
    });

    return sorted;
  }, [unreadFilteredAllTasks, sortDue]);

  // 전체 태스크 탭: 페이지네이션
  const paginatedAllTasks = useMemo(() => {
    const startIndex = (allTasksCurrentPage - 1) * allTasksItemsPerPage;
    const endIndex = startIndex + allTasksItemsPerPage;
    return sortedAllTasks.slice(startIndex, endIndex);
  }, [sortedAllTasks, allTasksCurrentPage, allTasksItemsPerPage]);

  // 전체 태스크 탭: 총 페이지 수
  const allTasksTotalPages = Math.ceil(sortedAllTasks.length / allTasksItemsPerPage) || 1;

  // 담당 업무 탭: 검색 필터링
  const searchedMyTasks = useMemo(() => {
    if (!debouncedSearch.trim()) return myTasks;

    const query = debouncedSearch.toLowerCase();
    return myTasks.filter((task) => {
      const titleMatch = task.title.toLowerCase().includes(query);
      const assigneeName = (task.assignee?.full_name || task.assignee?.email || "").toLowerCase();
      const assigneeMatch = assigneeName.includes(query);
      const assignerName = (task.assigner?.full_name || task.assigner?.email || "").toLowerCase();
      const assignerMatch = assignerName.includes(query);
      const clientNameMatch = (task.client_name || "").toLowerCase().includes(query);
      const uniqueIdMatch = task.id.slice(0, 8).toLowerCase().includes(query);

      return titleMatch || assigneeMatch || assignerMatch || clientNameMatch || uniqueIdMatch;
    });
  }, [myTasks, debouncedSearch]);

  // 담당 업무 탭: 카테고리 필터링
  const categoryFilteredMyTasks = useMemo(() => {
    if (category === "all") {
      return searchedMyTasks;
    }
    return searchedMyTasks.filter((task) => task.task_category === category);
  }, [searchedMyTasks, category]);

  // 담당 업무 탭: 상태 필터링
  const statusFilteredMyTasks = useMemo(() => {
    const dbStatus = statusMap[status];
    if (dbStatus === null) {
      return categoryFilteredMyTasks; // 전체 선택 시 모든 상태 표시 (이미 승인됨 제외된 상태)
    }
    return categoryFilteredMyTasks.filter((task) => task.task_status === dbStatus);
  }, [categoryFilteredMyTasks, status, statusMap]);

  // 담당 업무 탭: 안 읽은 메시지 필터링
  const unreadFilteredMyTasks = useMemo(() => {
    if (messageFilter === "all") {
      return statusFilteredMyTasks;
    }
    return statusFilteredMyTasks.filter(
      (task) => task.unread_message_count && task.unread_message_count > 0
    );
  }, [statusFilteredMyTasks, messageFilter]);

  // 담당 업무 탭: 정렬
  const sortedMyTasks = useMemo(() => {
    const sorted = [...unreadFilteredMyTasks];

    sorted.sort((a, b) => {
      if (sortDue === "asc") {
        // 마감일 빠른 순: 마감일이 없는 Task는 뒤로
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      } else {
        // 마감일 느린 순: 마감일이 없는 Task는 뒤로
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(b.due_date).getTime() - new Date(a.due_date).getTime();
      }
    });

    return sorted;
  }, [unreadFilteredMyTasks, sortDue]);

  // 담당 업무 탭: 페이지네이션
  const paginatedMyTasks = useMemo(() => {
    const startIndex = (myTasksCurrentPage - 1) * myTasksItemsPerPage;
    const endIndex = startIndex + myTasksItemsPerPage;
    return sortedMyTasks.slice(startIndex, endIndex);
  }, [sortedMyTasks, myTasksCurrentPage, myTasksItemsPerPage]);

  // 담당 업무 탭: 총 페이지 수
  const myTasksTotalPages = Math.ceil(sortedMyTasks.length / myTasksItemsPerPage) || 1;

  // 승인된 태스크 탭: 검색 필터링
  const searchedApprovedTasks = useMemo(() => {
    if (!debouncedSearch.trim()) return approvedTasks;

    const query = debouncedSearch.toLowerCase();
    return approvedTasks.filter((task) => {
      const titleMatch = task.title.toLowerCase().includes(query);
      const assigneeName = (task.assignee?.full_name || task.assignee?.email || "").toLowerCase();
      const assigneeMatch = assigneeName.includes(query);
      const assignerName = (task.assigner?.full_name || task.assigner?.email || "").toLowerCase();
      const assignerMatch = assignerName.includes(query);
      const clientNameMatch = (task.client_name || "").toLowerCase().includes(query);
      const uniqueIdMatch = task.id.slice(0, 8).toLowerCase().includes(query);

      return titleMatch || assigneeMatch || assignerMatch || clientNameMatch || uniqueIdMatch;
    });
  }, [approvedTasks, debouncedSearch]);

  // 승인된 태스크 탭: 카테고리 필터링
  const categoryFilteredApprovedTasks = useMemo(() => {
    if (category === "all") {
      return searchedApprovedTasks;
    }
    return searchedApprovedTasks.filter((task) => task.task_category === category);
  }, [searchedApprovedTasks, category]);

  // 승인된 태스크 탭: 이메일 발송 필터링
  const emailSentFilteredApprovedTasks = useMemo(() => {
    if (emailSent === "all") {
      return categoryFilteredApprovedTasks;
    } else if (emailSent === "sent") {
      return categoryFilteredApprovedTasks.filter((task) => task.send_email_to_client === true);
    } else {
      // not_sent
      return categoryFilteredApprovedTasks.filter((task) => task.send_email_to_client === false);
    }
  }, [categoryFilteredApprovedTasks, emailSent]);

  // 승인된 태스크 탭: 안 읽은 메시지 필터링
  const unreadFilteredApprovedTasks = useMemo(() => {
    if (messageFilter === "all") {
      return emailSentFilteredApprovedTasks;
    }
    return emailSentFilteredApprovedTasks.filter(
      (task) => task.unread_message_count && task.unread_message_count > 0
    );
  }, [emailSentFilteredApprovedTasks, messageFilter]);

  // 승인된 태스크 탭: 정렬 (생성일 기준)
  const sortedApprovedTasks = useMemo(() => {
    const sorted = [...unreadFilteredApprovedTasks];

    sorted.sort((a, b) => {
      if (sortDue === "asc") {
        if (!a.created_at && !b.created_at) return 0;
        if (!a.created_at) return 1;
        if (!b.created_at) return -1;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else {
        if (!a.created_at && !b.created_at) return 0;
        if (!a.created_at) return 1;
        if (!b.created_at) return -1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return sorted;
  }, [unreadFilteredApprovedTasks, sortDue]);

  // 승인된 태스크 탭: 페이지네이션
  const paginatedApprovedTasks = useMemo(() => {
    const startIndex = (approvedTasksCurrentPage - 1) * approvedTasksItemsPerPage;
    const endIndex = startIndex + approvedTasksItemsPerPage;
    return sortedApprovedTasks.slice(startIndex, endIndex);
  }, [sortedApprovedTasks, approvedTasksCurrentPage, approvedTasksItemsPerPage]);

  // 개인 태스크 탭: 검색 필터링 (고유 ID, 고객명, 지시사항만 검색)
  const searchedSelfTasks = useMemo(() => {
    if (!debouncedSearch.trim()) return selfTasks;

    const query = debouncedSearch.toLowerCase();
    return selfTasks.filter((task) => {
      const titleMatch = task.title.toLowerCase().includes(query); // 지시사항
      const clientNameMatch = (task.client_name || "").toLowerCase().includes(query); // 고객명
      const uniqueIdMatch = task.id.slice(0, 8).toLowerCase().includes(query); // 고유 ID

      return titleMatch || clientNameMatch || uniqueIdMatch;
    });
  }, [selfTasks, debouncedSearch]);

  // 개인 태스크 탭: 카테고리 필터링
  const categoryFilteredSelfTasks = useMemo(() => {
    if (category === "all") {
      return searchedSelfTasks;
    }
    return searchedSelfTasks.filter((task) => task.task_category === category);
  }, [searchedSelfTasks, category]);

  // 개인 태스크 탭: 상태 필터링 (전체, 진행중, 승인됨만)
  const statusFilteredSelfTasks = useMemo(() => {
    if (status === "all") {
      return categoryFilteredSelfTasks;
    }
    const statusMap: Record<StatusParam, TaskStatus | null> = {
      all: null,
      assigned: "ASSIGNED",
      in_progress: "IN_PROGRESS",
      waiting_confirm: "WAITING_CONFIRM",
      rejected: "REJECTED",
      approved: "APPROVED",
    };
    const dbStatus = statusMap[status];
    if (dbStatus === null) {
      return categoryFilteredSelfTasks;
    }
    return categoryFilteredSelfTasks.filter((task) => task.task_status === dbStatus);
  }, [categoryFilteredSelfTasks, status]);

  // 개인 태스크 탭: 이메일 발송 필터링
  const emailSentFilteredSelfTasks = useMemo(() => {
    if (emailSent === "all") {
      return statusFilteredSelfTasks;
    } else if (emailSent === "sent") {
      return statusFilteredSelfTasks.filter((task) => task.send_email_to_client === true);
    } else {
      // not_sent
      return statusFilteredSelfTasks.filter((task) => task.send_email_to_client === false);
    }
  }, [statusFilteredSelfTasks, emailSent]);

  // 개인 태스크 탭: 정렬
  const sortedSelfTasks = useMemo(() => {
    const sorted = [...emailSentFilteredSelfTasks];

    sorted.sort((a, b) => {
      // 마감일로 정렬
      if (sortDue === "asc") {
        // 마감일 빠른 순: 마감일이 없는 Task는 뒤로
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      } else {
        // 마감일 느린 순: 마감일이 없는 Task는 뒤로
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(b.due_date).getTime() - new Date(a.due_date).getTime();
      }
    });

    return sorted;
  }, [emailSentFilteredSelfTasks, sortDue]);

  // 개인 태스크 탭: 페이지네이션
  const paginatedSelfTasks = useMemo(() => {
    const startIndex = (selfTasksCurrentPage - 1) * selfTasksItemsPerPage;
    const endIndex = startIndex + selfTasksItemsPerPage;
    return sortedSelfTasks.slice(startIndex, endIndex);
  }, [sortedSelfTasks, selfTasksCurrentPage, selfTasksItemsPerPage]);

  // 개인 태스크 탭: 총 페이지 수
  const selfTasksTotalPages = Math.ceil(sortedSelfTasks.length / selfTasksItemsPerPage) || 1;

  // 참조된 업무 탭: 검색 필터링
  const searchedReferenceTasks = useMemo(() => {
    if (!debouncedSearch.trim()) return referenceTasks;
    const query = debouncedSearch.toLowerCase();
    return referenceTasks.filter((task) => {
      const titleMatch = task.title.toLowerCase().includes(query);
      const clientNameMatch = (task.client_name || "").toLowerCase().includes(query);
      const uniqueIdMatch = task.id.slice(0, 8).toLowerCase().includes(query);
      const assignerName = (task.assigner?.full_name || task.assigner?.email || "").toLowerCase().includes(query);
      const assigneeName = (task.assignee?.full_name || task.assignee?.email || "").toLowerCase().includes(query);
      return titleMatch || clientNameMatch || uniqueIdMatch || assignerName || assigneeName;
    });
  }, [referenceTasks, debouncedSearch]);

  // 참조된 업무 탭: 카테고리 필터링
  const categoryFilteredReferenceTasks = useMemo(() => {
    if (referenceCategory === "all") return searchedReferenceTasks;
    return searchedReferenceTasks.filter((task) => task.task_category === referenceCategory);
  }, [searchedReferenceTasks, referenceCategory]);

  // 참조된 업무 탭: 상태 필터링
  const statusFilteredReferenceTasks = useMemo(() => {
    const statusMap: Record<StatusParam, TaskStatus | null> = {
      all: null,
      assigned: "ASSIGNED",
      in_progress: "IN_PROGRESS",
      waiting_confirm: "WAITING_CONFIRM",
      rejected: "REJECTED",
      approved: "APPROVED",
    };
    const dbStatus = statusMap[referenceStatus];
    if (dbStatus === null) return categoryFilteredReferenceTasks;
    return categoryFilteredReferenceTasks.filter((task) => task.task_status === dbStatus);
  }, [categoryFilteredReferenceTasks, referenceStatus]);

  // 참조된 업무 탭: 안 읽은 메시지 필터링
  const unreadFilteredReferenceTasks = useMemo(() => {
    if (messageFilter === "all") {
      return statusFilteredReferenceTasks;
    }
    return statusFilteredReferenceTasks.filter(
      (task) => task.unread_message_count && task.unread_message_count > 0
    );
  }, [statusFilteredReferenceTasks, messageFilter]);

  // 참조된 업무 탭: 마감일 정렬
  const sortedReferenceTasks = useMemo(() => {
    const sorted = [...unreadFilteredReferenceTasks];
    sorted.sort((a, b) => {
      if (sortDue === "asc") {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      } else {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(b.due_date).getTime() - new Date(a.due_date).getTime();
      }
    });
    return sorted;
  }, [unreadFilteredReferenceTasks, sortDue]);

  // 참조된 업무 탭: 페이지네이션
  const paginatedReferenceTasks = useMemo(() => {
    const startIndex = (referenceTasksCurrentPage - 1) * referenceTasksItemsPerPage;
    const endIndex = startIndex + referenceTasksItemsPerPage;
    return sortedReferenceTasks.slice(startIndex, endIndex);
  }, [sortedReferenceTasks, referenceTasksCurrentPage, referenceTasksItemsPerPage]);

  // 참조된 업무 탭: 총 페이지 수
  const referenceTasksTotalPages = Math.ceil(sortedReferenceTasks.length / referenceTasksItemsPerPage) || 1;

  // 실시간 구독을 위한 현재 페이지 Task ID 목록 수집
  // Supabase Realtime 채널 제한(연결당 100개, 초당 100 조인)으로 현재 페이지 Task만 구독
  const currentTaskIds = useMemo(() => {
    if (activeTab === "my-tasks") {
      return paginatedMyTasks.map((task) => task.id).filter(Boolean);
    }
    if (activeTab === "all-tasks") {
      return paginatedAllTasks.map((task) => task.id).filter(Boolean);
    }
    if (activeTab === "approved-tasks") {
      return paginatedApprovedTasks.map((task) => task.id).filter(Boolean);
    }
    if (activeTab === "self-tasks") {
      return paginatedSelfTasks.map((task) => task.id).filter(Boolean);
    }
    if (activeTab === "reference-tasks") {
      return paginatedReferenceTasks.map((task) => task.id).filter(Boolean);
    }
    return [];
  }, [activeTab, paginatedMyTasks, paginatedAllTasks, paginatedApprovedTasks, paginatedSelfTasks, paginatedReferenceTasks]);

  // 실시간 구독 활성화
  useRealtimeDashboardMessages(currentTaskIds, true);

  // 승인된 태스크 탭: 총 페이지 수
  const approvedTasksTotalPages = Math.ceil(sortedApprovedTasks.length / approvedTasksItemsPerPage) || 1;

  // URL에서 q 파라미터 제거 (컴포넌트 마운트 시)
  useEffect(() => {
    if (searchParams.has("q")) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("q");
      setSearchParams(newParams, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 전체 태스크 탭에서 승인됨 상태가 URL에 있으면 제거
  useEffect(() => {
    if (activeTab === "all-tasks" && statusParam === "approved") {
      updateAllTasksUrlParams({ status: "all" });
    }
  }, [activeTab, statusParam]); // eslint-disable-line react-hooks/exhaustive-deps

  // URL 쿼리 파라미터 변경 시 탭 상태 및 검색어 동기화
  useEffect(() => {
    const tabParam = searchParams.get("tab") as DashboardTab | null;
    const newTab = tabParam === "all-tasks" || tabParam === "my-tasks" || tabParam === "approved-tasks" || tabParam === "self-tasks" || tabParam === "reference-tasks" ? tabParam : "my-tasks";
    const keywordFromUrl = searchParams.get("keyword") || "";
    
    if (newTab !== activeTab) {
      setActiveTab(newTab);
    }
    
    // URL에서 keyword가 변경되었을 때 searchQuery 동기화 (브라우저 뒤로가기/앞으로가기 등)
    if (keywordFromUrl !== searchQuery) {
      setSearchQuery(keywordFromUrl);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // 검색어/필터 변경 시 1페이지로 리셋 (전체 태스크 탭)
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      prevAllTasksFiltersRef.current = { search: debouncedSearch, category, status, sortDue };
      prevMyTasksFiltersRef.current = { search: debouncedSearch, category, status, sortDue };
      prevApprovedTasksFiltersRef.current = { search: debouncedSearch, category, sortDue, sortEmailSent, emailSent };
      prevSelfTasksFiltersRef.current = { search: debouncedSearch, category, status, sortDue, emailSent };
      return;
    }

    const prev = prevAllTasksFiltersRef.current;
    const allTasksFiltersChanged =
      prev.search !== debouncedSearch ||
      prev.category !== category ||
      prev.status !== status ||
      prev.sortDue !== sortDue;

    if (allTasksFiltersChanged && activeTab === "all-tasks" && allTasksCurrentPage !== 1) {
      updateAllTasksUrlParams({ allTasksPage: 1 });
    }

    prevAllTasksFiltersRef.current = { search: debouncedSearch, category, status, sortDue };
  }, [debouncedSearch, category, status, sortDue, activeTab, allTasksCurrentPage]);

  // 검색어/필터 변경 시 1페이지로 리셋 (담당 업무 탭)
  useEffect(() => {
    const prev = prevMyTasksFiltersRef.current;
    const myTasksFiltersChanged =
      prev.search !== debouncedSearch ||
      prev.category !== category ||
      prev.status !== status ||
      prev.sortDue !== sortDue;

    if (myTasksFiltersChanged && activeTab === "my-tasks" && myTasksCurrentPage !== 1) {
      updateMyTasksUrlParams({ myTasksPage: 1 });
    }

    prevMyTasksFiltersRef.current = { search: debouncedSearch, category, status, sortDue };
  }, [debouncedSearch, category, status, sortDue, activeTab, myTasksCurrentPage]);

  // 검색어/필터 변경 시 1페이지로 리셋 (승인된 태스크 탭)
  useEffect(() => {
    if (isFirstRenderRef.current) {
      prevApprovedTasksFiltersRef.current = { search: debouncedSearch, category, sortDue, sortEmailSent, emailSent };
      return;
    }

    const prev = prevApprovedTasksFiltersRef.current;
    const approvedTasksFiltersChanged =
      prev.search !== debouncedSearch ||
      prev.category !== category ||
      prev.sortDue !== sortDue ||
      prev.sortEmailSent !== sortEmailSent ||
      prev.emailSent !== emailSent;

    if (approvedTasksFiltersChanged && activeTab === "approved-tasks" && approvedTasksCurrentPage !== 1) {
      updateApprovedTasksUrlParams({ approvedTasksPage: 1 });
    }

    prevApprovedTasksFiltersRef.current = { search: debouncedSearch, category, sortDue, sortEmailSent, emailSent };
  }, [debouncedSearch, category, sortDue, sortEmailSent, emailSent, activeTab, approvedTasksCurrentPage]);

  // 검색어/필터 변경 시 1페이지로 리셋 (개인 태스크 탭)
  useEffect(() => {
    if (isFirstRenderRef.current) {
      prevSelfTasksFiltersRef.current = { search: debouncedSearch, category, status, sortDue, emailSent };
      return;
    }

    const prev = prevSelfTasksFiltersRef.current;
    const selfTasksFiltersChanged =
      prev.search !== debouncedSearch ||
      prev.category !== category ||
      prev.status !== status ||
      prev.sortDue !== sortDue ||
      prev.emailSent !== emailSent;

    if (selfTasksFiltersChanged && activeTab === "self-tasks" && selfTasksCurrentPage !== 1) {
      updateSelfTasksUrlParams({ selfTasksPage: 1 });
    }

    prevSelfTasksFiltersRef.current = { search: debouncedSearch, category, status, sortDue, emailSent };
  }, [debouncedSearch, category, status, sortDue, emailSent, activeTab, selfTasksCurrentPage]);

  // 잘못된 페이지 번호 체크 및 리셋
  useEffect(() => {
    if (activeTab === "all-tasks" && allTasksTotalPages > 0 && allTasksCurrentPage > allTasksTotalPages) {
      updateAllTasksUrlParams({ allTasksPage: 1 });
    }
    if (activeTab === "my-tasks" && myTasksTotalPages > 0 && myTasksCurrentPage > myTasksTotalPages) {
      updateMyTasksUrlParams({ myTasksPage: 1 });
    }
    if (activeTab === "approved-tasks" && approvedTasksTotalPages > 0 && approvedTasksCurrentPage > approvedTasksTotalPages) {
      updateApprovedTasksUrlParams({ approvedTasksPage: 1 });
    }
    if (activeTab === "self-tasks" && selfTasksTotalPages > 0 && selfTasksCurrentPage > selfTasksTotalPages) {
      updateSelfTasksUrlParams({ selfTasksPage: 1 });
    }
    if (activeTab === "reference-tasks" && referenceTasksTotalPages > 0 && referenceTasksCurrentPage > referenceTasksTotalPages) {
      updateReferenceTasksUrlParams({ referenceTasksPage: 1 });
    }
  }, [allTasksCurrentPage, allTasksTotalPages, myTasksCurrentPage, myTasksTotalPages, approvedTasksCurrentPage, approvedTasksTotalPages, selfTasksCurrentPage, selfTasksTotalPages, referenceTasksCurrentPage, referenceTasksTotalPages, activeTab]);

  const isLoading = allTasksLoading || myTasksLoading;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <DefaultSpinner />
      </div>
    );
  }

  return (
    <div className="sm:p-2">
      {/* 헤더 */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="mb-2 text-2xl font-bold sm:text-3xl">관리자 대시보드</h1>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "self-tasks" ? (
            /* 개인 태스크 탭: 나에게 Task 생성 버튼 */
            <Button
              onClick={() => {
                setPreSelectedCategory(undefined);
                setAutoFillMode(undefined);
                setPreFilledTitle(undefined);
                setIsSpecificationMode(false);
                setCreateTaskDialogOpen(true);
              }}
              className="h-9"
            >
              <Plus className="mr-2 h-4 w-4" />
              개인 업무 생성
            </Button>
          ) : (
            <>
              {/* 모바일: 빠른 생성 드롭다운 */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 md:hidden">
                    <Plus className="mr-2 h-4 w-4" />
                    빠른 생성
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => handleQuickCreate("REVIEW", "검토")}>
                    검토
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleQuickCreate("CONTRACT", "계약")}>
                    계약
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleQuickCreate("SPECIFICATION")}>
                    명세서
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleQuickCreate("REVISION", "수정")}>
                    수정
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleQuickCreate("APPLICATION", "출원")}>
                    출원
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {/* PC: 빠른 생성 버튼들 */}
              <div className="hidden md:flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() => handleQuickCreate("REVIEW", "검토")}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  검토
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() => handleQuickCreate("CONTRACT", "계약")}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  계약
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() => handleQuickCreate("SPECIFICATION")}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  명세서
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() => handleQuickCreate("REVISION", "수정")}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  수정
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() => handleQuickCreate("APPLICATION", "출원")}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  출원
                </Button>
              </div>
              {/* Task 생성 버튼 (공통) */}
              <Button
                onClick={() => {
                  setPreSelectedCategory(undefined);
                  setAutoFillMode(undefined);
                  setPreFilledTitle(undefined);
                  setIsSpecificationMode(false);
                  setCreateTaskDialogOpen(true);
                }}
                className="h-9"
              >
                <Plus className="mr-2 h-4 w-4" />
                업무 생성
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 메트릭 카드 (탭 위) */}
      <div className="mt-4">
        <DashboardMetrics role="admin" />
      </div>

      {/* 탭 전환 */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          const newTab = value as DashboardTab;
          // 탭 전환 시 모든 필터 초기화
          const newParams = new URLSearchParams();
          newParams.set("tab", newTab);
          setSearchParams(newParams, { replace: true });
          setActiveTab(newTab);
          setSearchQuery(""); // 검색어도 초기화
        }}
      >
        {/* 담당 업무 / 참조된 업무 / 전체 태스크 / 승인된 태스크 / 개인 태스크 탭 */}
        <TabsList className="mt-4">
          <TabsTrigger value="my-tasks">담당 업무</TabsTrigger>
          <TabsTrigger value="reference-tasks">참조 업무</TabsTrigger>
          <TabsTrigger value="all-tasks">전체 업무</TabsTrigger>
          <TabsTrigger value="approved-tasks">승인 업무</TabsTrigger>
          <TabsTrigger value="self-tasks">개인 업무</TabsTrigger>
        </TabsList>

        {/* 담당 업무 탭 */}
        <TabsContent value="my-tasks" className="space-y-4">
          {/* 필터 영역 */}
          <div className="space-y-3">
            {/* 모바일: Select 드롭다운 */}
            <div className="flex gap-2 sm:hidden">
              <Select value={category} onValueChange={(value) => handleMyTasksCategoryChange(value as CategoryParam)}>
                <SelectTrigger className="flex-1">
                  <SelectValue>
                    {category === "all" 
                      ? "전체 카테고리" 
                      : (["REVIEW", "REVISION", "CONTRACT", "SPECIFICATION", "APPLICATION"] as CategoryParam[]).find(c => c === category) === "REVIEW" ? "검토"
                      : (["REVIEW", "REVISION", "CONTRACT", "SPECIFICATION", "APPLICATION"] as CategoryParam[]).find(c => c === category) === "REVISION" ? "수정"
                      : (["REVIEW", "REVISION", "CONTRACT", "SPECIFICATION", "APPLICATION"] as CategoryParam[]).find(c => c === category) === "CONTRACT" ? "계약"
                      : (["REVIEW", "REVISION", "CONTRACT", "SPECIFICATION", "APPLICATION"] as CategoryParam[]).find(c => c === category) === "SPECIFICATION" ? "명세서"
                      : (["REVIEW", "REVISION", "CONTRACT", "SPECIFICATION", "APPLICATION"] as CategoryParam[]).find(c => c === category) === "APPLICATION" ? "출원"
                      : "전체"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(["all", "REVIEW", "REVISION", "CONTRACT", "SPECIFICATION", "APPLICATION"] as CategoryParam[]).map((categoryValue) => {
                    const categoryLabels: Record<CategoryParam, string> = {
                      all: "전체",
                      REVIEW: "검토",
                      REVISION: "수정",
                      CONTRACT: "계약",
                      SPECIFICATION: "명세서",
                      APPLICATION: "출원",
                    };
                    // 카테고리 필터는 기준이므로 상태 필터 및 검색어의 영향을 받지 않음
                    const count = categoryValue === "all"
                      ? myTasks.filter((task) => task.task_status !== "APPROVED").length
                      : myTasks.filter((task) => task.task_status !== "APPROVED" && task.task_category === categoryValue).length;
                    return (
                      <SelectItem key={categoryValue} value={categoryValue}>
                        {categoryLabels[categoryValue]} ({count}개)
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={(value) => handleMyTasksStatusChange(value as StatusParam)}>
                <SelectTrigger className="flex-1">
                  <SelectValue>
                    {status === "all" 
                      ? "전체 상태" 
                      : status === "assigned" ? "할당됨"
                      : status === "in_progress" ? "진행중"
                      : status === "waiting_confirm" ? "확인대기"
                      : status === "rejected" ? "거부됨"
                      : "전체"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(["all", "assigned", "in_progress", "waiting_confirm", "rejected"] as StatusParam[]).map((statusValue) => {
                    const statusLabels: Record<StatusParam, string> = {
                      all: "전체",
                      assigned: "할당됨",
                      in_progress: "진행중",
                      waiting_confirm: "확인대기",
                      rejected: "거부됨",
                      approved: "승인됨",
                    };
                    const filteredByCategory = category === "all"
                      ? searchedMyTasks
                      : searchedMyTasks.filter((task) => task.task_category === category);
                    const dbStatus = statusMap[statusValue];
                    const count = dbStatus === null 
                      ? filteredByCategory.filter((task) => task.task_status !== "APPROVED").length
                      : filteredByCategory.filter((task) => task.task_status === dbStatus).length;
                    return (
                      <SelectItem key={statusValue} value={statusValue}>
                        {statusLabels[statusValue]} ({count}개)
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            {/* 태블릿/PC: 버튼 그룹 */}
            <div className="hidden sm:block space-y-2">
              {/* 카테고리 필터 버튼 */}
              <div className="flex flex-wrap gap-2">
                {(["all", "REVIEW", "REVISION", "CONTRACT", "SPECIFICATION", "APPLICATION"] as CategoryParam[]).map((categoryValue) => {
                  const categoryLabels: Record<CategoryParam, string> = {
                    all: "전체",
                    REVIEW: "검토",
                    REVISION: "수정",
                    CONTRACT: "계약",
                    SPECIFICATION: "명세서",
                    APPLICATION: "출원",
                  };
                  // 카테고리 필터는 기준이므로 상태 필터 및 검색어의 영향을 받지 않음
                  const count = categoryValue === "all"
                    ? myTasks.filter((task) => task.task_status !== "APPROVED").length
                    : myTasks.filter((task) => task.task_status !== "APPROVED" && task.task_category === categoryValue).length;
                  
                  return (
                    <Button
                      key={categoryValue}
                      variant={category === categoryValue ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleMyTasksCategoryChange(categoryValue)}
                      className="p-1 sm:p-1.5"
                    >
                      {categoryLabels[categoryValue]} ({count}개)
                    </Button>
                  );
                })}
              </div>
              {/* 상태 필터 버튼 */}
              <div className="flex flex-wrap gap-2">
                {(["all", "assigned", "in_progress", "waiting_confirm", "rejected"] as StatusParam[]).map((statusValue) => {
                  const statusLabels: Record<StatusParam, string> = {
                    all: "전체",
                    assigned: "할당됨",
                    in_progress: "진행중",
                    waiting_confirm: "확인대기",
                    rejected: "거부됨",
                    approved: "승인됨",
                  };
                  const filteredByCategory = category === "all"
                    ? searchedMyTasks
                    : searchedMyTasks.filter((task) => task.task_category === category);
                  const dbStatus = statusMap[statusValue];
                  const count = dbStatus === null 
                    ? filteredByCategory.filter((task) => task.task_status !== "APPROVED").length
                    : filteredByCategory.filter((task) => task.task_status === dbStatus).length;
                  
                  return (
                    <Button
                      key={statusValue}
                      variant={status === statusValue ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleMyTasksStatusChange(statusValue)}
                      className="p-1 sm:p-1.5"

                    >
                      {statusLabels[statusValue]} ({count}개)
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
          {/* 검색창 및 안 읽은 메시지 필터 */}
          <div className="flex gap-2 w-full">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="고유 ID, 고객명, 지시사항, 지시자/담당자명으로 검색하세요..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={messageFilter} onValueChange={(value) => handleMessageFilterChange(value as MessageFilterParam)}>
              <SelectTrigger className="min-w-45">
                <SelectValue>
                  {messageFilter === "not-read" ? "메시지를 읽지 않은 업무" : "전체"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="not-read">메시지를 읽지 않은 업무</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Task 테이블 */}
          <div className="overflow-x-scroll">
            <table className="w-full min-w-[800px] table-fixed">
              <thead>
                <tr className="border-b">
                  <th className="w-[14.285%] px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm">
                    고유 ID
                  </th>
                  <th className="w-[14.285%] px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm">
                    고객명
                  </th>
                  <th className="w-[14.285%] px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm">
                    지시사항
                  </th>
                  <th
                    className="hover:bg-muted/50 w-[14.285%] cursor-pointer px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm"
                    onClick={handleMyTasksSortDueChange}
                  >
                    <div className="flex items-center gap-2">
                      마감일
                      <ArrowUpDown className="size-3 sm:size-4" />
                    </div>
                  </th>
                  <th className="w-[14.285%] px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm">
                    <StatusFilterDropdown
                      status={status}
                      onStatusChange={handleMyTasksStatusChange}
                      tasks={searchedMyTasks}
                      hideApproved={true}
                    />
                  </th>
                  <th className="w-[14.285%] px-2 py-3 text-center text-xs font-medium sm:px-4 sm:text-sm">
                    새 메시지
                  </th>
                  <th className="w-[14.285%] px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm">
                    지시자/담당자
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedMyTasks.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-muted-foreground h-24 text-center text-xs sm:text-sm"
                    >
                      {(debouncedSearch || category !== "all" || status !== "all") ? "조건에 맞는 업무가 없습니다." : "업무가 없습니다."}
                    </td>
                  </tr>
                ) : (
                  paginatedMyTasks.map((task) => {
                    const dueDate = formatDueDate(task.due_date);
                    const daysDiff = calculateDaysDifference(task.due_date);
                    const dDayText = getDDayText(daysDiff);
                    const dueDateColorClass = getDueDateColorClass(daysDiff, task.task_status);

                    const assignerName = task.assigner?.full_name || task.assigner?.email?.split('@')[0] || '-';
                    const assigneeName = task.assignee?.full_name || task.assignee?.email?.split('@')[0] || '-';
                    const assignerAssigneeDisplay = `${assignerName} / ${assigneeName}`;

                    return (
                      <tr
                        key={task.id}
                        className="hover:bg-muted/50 border-b transition-colors cursor-pointer"
                        onClick={() => {
                          const currentUrl =
                            window.location.pathname + window.location.search;
                          sessionStorage.setItem("previousDashboardUrl", currentUrl);
                          navigate(`/tasks/${task.id}`);
                        }}
                      >
                        <td className="px-2 py-3 sm:px-4 sm:py-4">
                          <div className="line-clamp-2 text-xs sm:text-sm">
                            {task.id ? (
                              <span className="font-mono text-xs text-primary">{task.id.slice(0, 8).toUpperCase()}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-3 sm:px-4 sm:py-4">
                          <div className="line-clamp-2 text-xs sm:text-sm">
                            {task.client_name || (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-3 sm:px-4 sm:py-4">
                          <div className="line-clamp-2 text-xs sm:text-sm">
                            <Link
                              to={`/tasks/${task.id}`}
                              className="line-clamp-2 hover:underline cursor-pointer text-primary"
                              onClick={(e) => {
                                e.stopPropagation(); // 행 클릭 이벤트와 중복 방지
                                const currentUrl =
                                  window.location.pathname + window.location.search;
                                sessionStorage.setItem("previousDashboardUrl", currentUrl);
                              }}
                            >
                              {task.title}
                            </Link>
                          </div>
                        </td>
                        <td className="px-2 py-3 sm:px-4 sm:py-4">
                          {dueDate ? (
                            <span
                              className={cn(
                                "text-xs whitespace-nowrap sm:text-sm",
                                dueDateColorClass,
                              )}
                            >
                              {dueDate} {dDayText}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs sm:text-sm">-</span>
                          )}
                        </td>
                        <td className="px-2 py-3 sm:px-4 sm:py-4">
                          <TaskStatusBadge status={task.task_status} />
                        </td>
                        <td className="px-2 py-3 text-center sm:px-4 sm:py-4">
                          {task.unread_message_count && task.unread_message_count > 0 ? (
                            <div className="relative inline-flex">
                              <Bell className="h-6 w-6" style={{ fill: "oklch(0.637 0.237 25.331)", color: "oklch(0.637 0.237 25.331)" }} />
                              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-semibold text-white">
                                {task.unread_message_count}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs sm:text-sm">-</span>
                          )}
                        </td>
                        <td className="px-2 py-3 sm:px-4 sm:py-4">
                          <div className="line-clamp-2 text-xs sm:text-sm">{assignerAssigneeDisplay}</div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {sortedMyTasks.length > 0 && (
            <TablePagination
              currentPage={myTasksCurrentPage}
              totalPages={myTasksTotalPages}
              pageSize={myTasksItemsPerPage}
              totalItems={sortedMyTasks.length}
              selectedCount={0}
              onPageChange={(page) => {
                updateMyTasksUrlParams({ myTasksPage: page });
              }}
              onPageSizeChange={(newPageSize) => {
                setMyTasksItemsPerPage(newPageSize);
                sessionStorage.setItem("tablePageSize", newPageSize.toString());
                updateMyTasksUrlParams({ myTasksPage: 1 });
              }}
            />
          )}
        </TabsContent>

        {/* 전체 태스크 탭 */}
        <TabsContent value="all-tasks" className="space-y-4">
          {/* 필터 영역 */}
          <div className="space-y-3">
            {/* 모바일: Select 드롭다운 */}
            <div className="flex gap-2 sm:hidden">
              <Select value={category} onValueChange={(value) => handleAllTasksCategoryChange(value as CategoryParam)}>
                <SelectTrigger className="flex-1">
                  <SelectValue>
                    {category === "all" 
                      ? "전체 카테고리" 
                      : (["REVIEW", "REVISION", "CONTRACT", "SPECIFICATION", "APPLICATION"] as CategoryParam[]).find(c => c === category) === "REVIEW" ? "검토"
                      : (["REVIEW", "REVISION", "CONTRACT", "SPECIFICATION", "APPLICATION"] as CategoryParam[]).find(c => c === category) === "REVISION" ? "수정"
                      : (["REVIEW", "REVISION", "CONTRACT", "SPECIFICATION", "APPLICATION"] as CategoryParam[]).find(c => c === category) === "CONTRACT" ? "계약"
                      : (["REVIEW", "REVISION", "CONTRACT", "SPECIFICATION", "APPLICATION"] as CategoryParam[]).find(c => c === category) === "SPECIFICATION" ? "명세서"
                      : (["REVIEW", "REVISION", "CONTRACT", "SPECIFICATION", "APPLICATION"] as CategoryParam[]).find(c => c === category) === "APPLICATION" ? "출원"
                      : "전체"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(["all", "REVIEW", "REVISION", "CONTRACT", "SPECIFICATION", "APPLICATION"] as CategoryParam[]).map((categoryValue) => {
                    const categoryLabels: Record<CategoryParam, string> = {
                      all: "전체",
                      REVIEW: "검토",
                      REVISION: "수정",
                      CONTRACT: "계약",
                      SPECIFICATION: "명세서",
                      APPLICATION: "출원",
                    };
                    // 카테고리 필터는 기준이므로 상태 필터 및 검색어의 영향을 받지 않음
                    const count = categoryValue === "all"
                      ? allTasks.length
                      : allTasks.filter((task) => task.task_category === categoryValue).length;
                    return (
                      <SelectItem key={categoryValue} value={categoryValue}>
                        {categoryLabels[categoryValue]} ({count}개)
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={(value) => handleAllTasksStatusChange(value as StatusParam)}>
                <SelectTrigger className="flex-1">
                  <SelectValue>
                    {status === "all" 
                      ? "전체 상태" 
                      : status === "assigned" ? "할당됨"
                      : status === "in_progress" ? "진행중"
                      : status === "waiting_confirm" ? "확인대기"
                      : status === "rejected" ? "거부됨"
                      : "전체"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(["all", "assigned", "in_progress", "waiting_confirm", "rejected"] as StatusParam[]).map((statusValue) => {
                    const statusLabels: Record<StatusParam, string> = {
                      all: "전체",
                      assigned: "할당됨",
                      in_progress: "진행중",
                      waiting_confirm: "확인대기",
                      rejected: "거부됨",
                      approved: "승인됨",
                    };
                    const filteredByCategory = category === "all"
                      ? searchedAllTasks
                      : searchedAllTasks.filter((task) => task.task_category === category);
                    const dbStatus = statusMap[statusValue];
                    const count = dbStatus === null 
                      ? filteredByCategory.length
                      : filteredByCategory.filter((task) => task.task_status === dbStatus).length;
                    return (
                      <SelectItem key={statusValue} value={statusValue}>
                        {statusLabels[statusValue]} ({count}개)
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            {/* 태블릿/PC: 버튼 그룹 */}
            <div className="hidden sm:block space-y-2">
              {/* 카테고리 필터 버튼 */}
              <div className="flex flex-wrap gap-2">
                {(["all", "REVIEW", "REVISION", "CONTRACT", "SPECIFICATION", "APPLICATION"] as CategoryParam[]).map((categoryValue) => {
                  const categoryLabels: Record<CategoryParam, string> = {
                    all: "전체",
                    REVIEW: "검토",
                    REVISION: "수정",
                    CONTRACT: "계약",
                    SPECIFICATION: "명세서",
                    APPLICATION: "출원",
                  };
                  // 카테고리 필터는 기준이므로 상태 필터 및 검색어의 영향을 받지 않음
                  const count = categoryValue === "all"
                    ? allTasks.length
                    : allTasks.filter((task) => task.task_category === categoryValue).length;
                  
                  return (
                    <Button
                      key={categoryValue}
                      variant={category === categoryValue ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleAllTasksCategoryChange(categoryValue)}
                      className="p-1 sm:p-1.5"

                    >
                      {categoryLabels[categoryValue]} ({count}개)
                    </Button>
                  );
                })}
              </div>
              {/* 상태 필터 버튼 */}
              <div className="flex flex-wrap gap-2">
                {(["all", "assigned", "in_progress", "waiting_confirm", "rejected"] as StatusParam[]).map((statusValue) => {
                  const statusLabels: Record<StatusParam, string> = {
                    all: "전체",
                    assigned: "할당됨",
                    in_progress: "진행중",
                    waiting_confirm: "확인대기",
                    rejected: "거부됨",
                    approved: "승인됨",
                  };
                  const filteredByCategory = category === "all"
                    ? searchedAllTasks
                    : searchedAllTasks.filter((task) => task.task_category === category);
                  const dbStatus = statusMap[statusValue];
                  const count = dbStatus === null 
                    ? filteredByCategory.length
                    : filteredByCategory.filter((task) => task.task_status === dbStatus).length;
                  
                  return (
                    <Button
                      key={statusValue}
                      variant={status === statusValue ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleAllTasksStatusChange(statusValue)}
                      className="p-1 sm:p-1.5"

                    >
                      {statusLabels[statusValue]} ({count}개)
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
          {/* 검색창 및 안 읽은 메시지 필터 */}
          <div className="flex gap-2 w-full">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="고유 ID, 고객명, 지시사항, 지시자/담당자명으로 검색하세요..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={messageFilter} onValueChange={(value) => handleMessageFilterChange(value as MessageFilterParam)}>
              <SelectTrigger className="min-w-45">
                <SelectValue>
                  {messageFilter === "not-read" ? "메시지를 읽지 않은 업무" : "전체"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="not-read">메시지를 읽지 않은 업무</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Task 테이블 */}
          <div className="overflow-x-scroll">
            <table className="w-full min-w-[800px] table-fixed">
              <thead>
                <tr className="border-b">
                  <th className="w-[14.285%] px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm">
                    고유 ID
                  </th>
                  <th className="w-[14.285%] px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm">
                    고객명
                  </th>
                  <th className="w-[14.285%] px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm">
                    지시사항
                  </th>
                  <th
                    className="hover:bg-muted/50 w-[14.285%] cursor-pointer px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm"
                    onClick={handleAllTasksSortDueChange}
                  >
                    <div className="flex items-center gap-2">
                      마감일
                      <ArrowUpDown className="size-3 sm:size-4" />
                    </div>
                  </th>
                  <th className="w-[14.285%] px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm">
                    <StatusFilterDropdown
                      status={status}
                      onStatusChange={handleAllTasksStatusChange}
                      tasks={searchedAllTasks}
                      hideApproved={true}
                    />
                  </th>
                  <th className="w-[14.285%] px-2 py-3 text-center text-xs font-medium sm:px-4 sm:text-sm">
                    새 메시지
                  </th>
                  <th className="w-[14.285%] px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm">
                    지시자/담당자
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedAllTasks.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-muted-foreground h-24 text-center text-xs sm:text-sm"
                    >
                      {(debouncedSearch || category !== "all" || status !== "all") ? "조건에 맞는 업무가 없습니다." : "업무가 없습니다."}
                    </td>
                  </tr>
                ) : (
                  paginatedAllTasks.map((task) => {
                    const dueDate = formatDueDate(task.due_date);
                    const daysDiff = calculateDaysDifference(task.due_date);
                    const dDayText = getDDayText(daysDiff);
                    const dueDateColorClass = getDueDateColorClass(daysDiff, task.task_status);

                    const assignerName = task.assigner?.full_name || task.assigner?.email?.split('@')[0] || '-';
                    const assigneeName = task.assignee?.full_name || task.assignee?.email?.split('@')[0] || '-';
                    const assignerAssigneeDisplay = `${assignerName} / ${assigneeName}`;

                    return (
                      <tr
                        key={task.id}
                        className="hover:bg-muted/50 border-b transition-colors cursor-pointer"
                        onClick={() => {
                          const currentUrl =
                            window.location.pathname + window.location.search;
                          sessionStorage.setItem("previousDashboardUrl", currentUrl);
                          navigate(`/tasks/${task.id}`);
                        }}
                      >
                        <td className="px-2 py-3 sm:px-4 sm:py-4">
                          <div className="line-clamp-2 text-xs sm:text-sm">
                            {task.id ? (
                              <span className="font-mono text-xs text-primary">{task.id.slice(0, 8).toUpperCase()}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-3 sm:px-4 sm:py-4">
                          <div className="line-clamp-2 text-xs sm:text-sm">
                            {task.client_name || (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-3 sm:px-4 sm:py-4">
                          <div className="line-clamp-2 text-xs sm:text-sm">
                            <Link
                              to={`/tasks/${task.id}`}
                              className="line-clamp-2 hover:underline cursor-pointer text-primary"
                              onClick={(e) => {
                                e.stopPropagation(); // 행 클릭 이벤트와 중복 방지
                                const currentUrl =
                                  window.location.pathname + window.location.search;
                                sessionStorage.setItem("previousDashboardUrl", currentUrl);
                              }}
                            >
                              {task.title}
                            </Link>
                          </div>
                        </td>
                        <td className="px-2 py-3 sm:px-4 sm:py-4">
                          {dueDate ? (
                            <span
                              className={cn(
                                "text-xs whitespace-nowrap sm:text-sm",
                                dueDateColorClass,
                              )}
                            >
                              {dueDate} {dDayText}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs sm:text-sm">-</span>
                          )}
                        </td>
                        <td className="px-2 py-3 sm:px-4 sm:py-4">
                          <TaskStatusBadge status={task.task_status} />
                        </td>
                        <td className="px-2 py-3 text-center sm:px-4 sm:py-4">
                          {task.unread_message_count && task.unread_message_count > 0 ? (
                            <div className="relative inline-flex">
                              <Bell className="h-6 w-6" style={{ fill: "oklch(0.637 0.237 25.331)", color: "oklch(0.637 0.237 25.331)" }} />
                              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-semibold text-white">
                                {task.unread_message_count}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs sm:text-sm">-</span>
                          )}
                        </td>
                        <td className="px-2 py-3 sm:px-4 sm:py-4">
                          <div className="line-clamp-2 text-xs sm:text-sm">{assignerAssigneeDisplay}</div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {sortedAllTasks.length > 0 && (
            <TablePagination
              currentPage={allTasksCurrentPage}
              totalPages={allTasksTotalPages}
              pageSize={allTasksItemsPerPage}
              totalItems={sortedAllTasks.length}
              selectedCount={0}
              onPageChange={(page) => {
                updateAllTasksUrlParams({ allTasksPage: page });
              }}
              onPageSizeChange={(newPageSize) => {
                setAllTasksItemsPerPage(newPageSize);
                sessionStorage.setItem("tablePageSize", newPageSize.toString());
                updateAllTasksUrlParams({ allTasksPage: 1 });
              }}
            />
          )}
        </TabsContent>

        {/* 승인된 태스크 탭 */}
        <TabsContent value="approved-tasks" className="space-y-4">
          {/* 필터 영역 */}
          <div className="space-y-3">
            {/* 모바일: Select 드롭다운 */}
            <div className="flex gap-2 sm:hidden">
              <Select value={category} onValueChange={(value) => handleApprovedTasksCategoryChange(value as CategoryParam)}>
                <SelectTrigger className="flex-1">
                  <SelectValue>
                    {category === "all" 
                      ? "전체 카테고리" 
                      : (["REVIEW", "REVISION", "CONTRACT", "SPECIFICATION", "APPLICATION"] as CategoryParam[]).find(c => c === category) === "REVIEW" ? "검토"
                      : (["REVIEW", "REVISION", "CONTRACT", "SPECIFICATION", "APPLICATION"] as CategoryParam[]).find(c => c === category) === "REVISION" ? "수정"
                      : (["REVIEW", "REVISION", "CONTRACT", "SPECIFICATION", "APPLICATION"] as CategoryParam[]).find(c => c === category) === "CONTRACT" ? "계약"
                      : (["REVIEW", "REVISION", "CONTRACT", "SPECIFICATION", "APPLICATION"] as CategoryParam[]).find(c => c === category) === "SPECIFICATION" ? "명세서"
                      : (["REVIEW", "REVISION", "CONTRACT", "SPECIFICATION", "APPLICATION"] as CategoryParam[]).find(c => c === category) === "APPLICATION" ? "출원"
                      : "전체"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(["all", "REVIEW", "REVISION", "CONTRACT", "SPECIFICATION", "APPLICATION"] as CategoryParam[]).map((categoryValue) => {
                    const categoryLabels: Record<CategoryParam, string> = {
                      all: "전체",
                      REVIEW: "검토",
                      REVISION: "수정",
                      CONTRACT: "계약",
                      SPECIFICATION: "명세서",
                      APPLICATION: "출원",
                    };
                    // 카테고리 필터는 기준이므로 이메일 발송 필터 및 검색어의 영향을 받지 않음
                    const count = categoryValue === "all"
                      ? approvedTasks.length
                      : approvedTasks.filter((task) => task.task_category === categoryValue).length;
                    return (
                      <SelectItem key={categoryValue} value={categoryValue}>
                        {categoryLabels[categoryValue]} ({count}개)
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Select value={emailSent} onValueChange={(value) => handleApprovedTasksEmailSentChange(value as EmailSentParam)}>
                <SelectTrigger className="flex-1">
                  <SelectValue>
                    {emailSent === "all" 
                      ? "전체 이메일" 
                      : emailSent === "sent" ? "전송완료"
                      : emailSent === "not_sent" ? "미전송"
                      : "전체"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(["all", "sent", "not_sent"] as EmailSentParam[]).map((emailSentValue) => {
                    const emailSentLabels: Record<EmailSentParam, string> = {
                      all: "전체",
                      sent: "전송완료",
                      not_sent: "미전송",
                    };
                    const filteredByCategory = category === "all"
                      ? searchedApprovedTasks
                      : searchedApprovedTasks.filter((task) => task.task_category === category);
                    const count = emailSentValue === "all"
                      ? filteredByCategory.length
                      : emailSentValue === "sent"
                      ? filteredByCategory.filter((task) => task.send_email_to_client === true).length
                      : filteredByCategory.filter((task) => task.send_email_to_client === false).length;
                    return (
                      <SelectItem key={emailSentValue} value={emailSentValue}>
                        {emailSentLabels[emailSentValue]} ({count}개)
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            {/* 태블릿/PC: 버튼 그룹 */}
            <div className="hidden sm:block space-y-2">
              {/* 카테고리 필터 버튼 */}
              <div className="flex flex-wrap gap-2">
                {(["all", "REVIEW", "REVISION", "CONTRACT", "SPECIFICATION", "APPLICATION"] as CategoryParam[]).map((categoryValue) => {
                  const categoryLabels: Record<CategoryParam, string> = {
                    all: "전체",
                    REVIEW: "검토",
                    REVISION: "수정",
                    CONTRACT: "계약",
                    SPECIFICATION: "명세서",
                    APPLICATION: "출원",
                  };
                  // 카테고리 필터는 기준이므로 이메일 발송 필터 및 검색어의 영향을 받지 않음
                  const count = categoryValue === "all"
                    ? approvedTasks.length
                    : approvedTasks.filter((task) => task.task_category === categoryValue).length;
                  
                  return (
                    <Button
                      key={categoryValue}
                      variant={category === categoryValue ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleApprovedTasksCategoryChange(categoryValue)}
                      className="p-1 sm:p-1.5"
                    >
                      {categoryLabels[categoryValue]} ({count}개)
                    </Button>
                  );
                })}
              </div>
              {/* 이메일 발송 필터 버튼 */}
              <div className="flex flex-wrap gap-2">
                {(["all", "sent", "not_sent"] as EmailSentParam[]).map((emailSentValue) => {
                  const emailSentLabels: Record<EmailSentParam, string> = {
                    all: "전체",
                    sent: "전송완료",
                    not_sent: "미전송",
                  };
                  const filteredByCategory = category === "all"
                    ? searchedApprovedTasks
                    : searchedApprovedTasks.filter((task) => task.task_category === category);
                  const count = emailSentValue === "all"
                    ? filteredByCategory.length
                    : emailSentValue === "sent"
                    ? filteredByCategory.filter((task) => task.send_email_to_client === true).length
                    : filteredByCategory.filter((task) => task.send_email_to_client === false).length;
                  
                  return (
                    <Button
                      key={emailSentValue}
                      variant={emailSent === emailSentValue ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleApprovedTasksEmailSentChange(emailSentValue)}
                      className="p-1 sm:p-1.5"
                    >
                      {emailSentLabels[emailSentValue]} ({count}개)
                    </Button>
                    );
                  })}
              </div>
            </div>
          </div>
          {/* 검색창 및 안 읽은 메시지 필터 */}
          <div className="flex gap-2 w-full">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="고유 ID, 고객명, 지시사항, 지시자/담당자명으로 검색하세요..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={messageFilter} onValueChange={(value) => handleMessageFilterChange(value as MessageFilterParam)}>
              <SelectTrigger className="min-w-45">
                <SelectValue>
                  {messageFilter === "not-read" ? "메시지를 읽지 않은 업무" : "전체"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="not-read">메시지를 읽지 않은 업무</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Task 테이블 */}
          <div className="overflow-x-scroll">
            <table className="w-full min-w-[800px] table-fixed">
              <thead>
                <tr className="border-b">
                  <th className="w-[14.285%] px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm">
                    고유 ID
                  </th>
                  <th className="w-[14.285%] px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm">
                    고객명
                  </th>
                  <th className="w-[14.285%] px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm">
                    지시사항
                  </th>
                  <th
                    className="hover:bg-muted/50 w-[14.285%] cursor-pointer px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm"
                    onClick={handleApprovedTasksSortDueChange}
                  >
                    <div className="flex items-center gap-2">
                      생성일
                      <ArrowUpDown className="size-3 sm:size-4" />
                    </div>
                  </th>
                  <th className="w-[14.285%] px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm">
                    <EmailSentFilterDropdown
                      emailSent={emailSent}
                      onEmailSentChange={handleApprovedTasksEmailSentChange}
                      tasks={searchedApprovedTasks}
                    />
                  </th>
                  <th className="w-[14.285%] px-2 py-3 text-center text-xs font-medium sm:px-4 sm:text-sm">
                    새 메시지
                  </th>
                  <th className="w-[14.285%] px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm">
                    지시자/담당자
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedApprovedTasks.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-muted-foreground h-24 text-center text-xs sm:text-sm"
                    >
                      {(debouncedSearch || category !== "all" || emailSent !== "all") ? "조건에 맞는 업무가 없습니다." : "업무가 없습니다."}
                    </td>
                  </tr>
                ) : (
                  paginatedApprovedTasks.map((task) => {
                    const createdAt = task.created_at ? formatCreatedDate(task.created_at) : null;

                    const assignerName = task.assigner?.full_name || task.assigner?.email?.split('@')[0] || '-';
                    const assigneeName = task.assignee?.full_name || task.assignee?.email?.split('@')[0] || '-';
                    const assignerAssigneeDisplay = `${assignerName} / ${assigneeName}`;
                    const isReferencedTask = "isReferencedTask" in task && task.isReferencedTask === true;

                    return (
                      <tr
                        key={task.id}
                        className={cn(
                          "hover:bg-muted/50 border-b transition-colors cursor-pointer",
                          isReferencedTask && "bg-primary/20",
                        )}
                        onClick={() => {
                          const currentUrl =
                            window.location.pathname + window.location.search;
                          sessionStorage.setItem("previousDashboardUrl", currentUrl);
                          navigate(`/tasks/${task.id}`);
                        }}
                      >
                        <td className="px-2 py-3 sm:px-4 sm:py-4">
                          <div className="line-clamp-2 text-xs sm:text-sm">
                            {task.id ? (
                              <span className="font-mono text-xs text-primary">{task.id.slice(0, 8).toUpperCase()}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-3 sm:px-4 sm:py-4">
                          <div className="line-clamp-2 text-xs sm:text-sm">
                            {task.client_name || (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-3 sm:px-4 sm:py-4">
                          <div className="line-clamp-2 text-xs sm:text-sm">
                            <Link
                              to={`/tasks/${task.id}`}
                              className="line-clamp-2 hover:underline cursor-pointer text-primary"
                              onClick={(e) => {
                                e.stopPropagation(); // 행 클릭 이벤트와 중복 방지
                                const currentUrl =
                                  window.location.pathname + window.location.search;
                                sessionStorage.setItem("previousDashboardUrl", currentUrl);
                              }}
                            >
                              {task.title}
                            </Link>
                          </div>
                        </td>
                        <td className="px-2 py-3 sm:px-4 sm:py-4">
                          {createdAt ? (
                            <span className="text-xs whitespace-nowrap sm:text-sm">
                              {createdAt}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs sm:text-sm">-</span>
                          )}
                        </td>
                        <td className="px-2 py-3 sm:px-4 sm:py-4">
                          {(() => {
                            const isAssignee = task.assignee_id === currentProfile?.id;
                            const isReference = task.references?.some((ref) => ref.id === currentProfile?.id) ?? false;
                            const canEdit = isAssignee || isReference;
                            return (
                              <button
                                onClick={(e) => handleEmailSentToggle(task, e)}
                                disabled={!canEdit || updateTask.isPending}
                                className={cn(
                                  "flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors",
                                  "hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50",
                                  canEdit && "cursor-pointer"
                                )}
                              >
                                {task.send_email_to_client ? (
                                  <>
                                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" />
                                    <span className="text-xs sm:text-sm whitespace-nowrap">전송 완료</span>
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-xs sm:text-sm">미전송</span>
                                  </>
                                )}
                              </button>
                            );
                          })()}
                        </td>
                        <td className="px-2 py-3 text-center sm:px-4 sm:py-4">
                          {task.unread_message_count && task.unread_message_count > 0 ? (
                            <div className="relative inline-flex">
                              <Bell className="h-6 w-6" style={{ fill: "oklch(0.637 0.237 25.331)", color: "oklch(0.637 0.237 25.331)" }} />
                              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-semibold text-white">
                                {task.unread_message_count}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs sm:text-sm">-</span>
                          )}
                        </td>
                        <td className="px-2 py-3 sm:px-4 sm:py-4">
                          <div className="line-clamp-2 text-xs sm:text-sm">{assignerAssigneeDisplay}</div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {sortedApprovedTasks.length > 0 && (
            <TablePagination
              currentPage={approvedTasksCurrentPage}
              totalPages={approvedTasksTotalPages}
              pageSize={approvedTasksItemsPerPage}
              totalItems={sortedApprovedTasks.length}
              selectedCount={0}
              onPageChange={(page) => {
                updateApprovedTasksUrlParams({ approvedTasksPage: page });
              }}
              onPageSizeChange={(newPageSize) => {
                setApprovedTasksItemsPerPage(newPageSize);
                sessionStorage.setItem("tablePageSize", newPageSize.toString());
                updateApprovedTasksUrlParams({ approvedTasksPage: 1 });
              }}
            />
          )}
        </TabsContent>

        {/* 개인 태스크 탭 */}
        <TabsContent value="self-tasks" className="space-y-4">
          {/* 필터 영역 */}
          <div className="space-y-3">
            {/* 모바일: Select 드롭다운 */}
            <div className="flex gap-2 sm:hidden">
              <Select value={category} onValueChange={(value) => handleSelfTasksCategoryChange(value as CategoryParam)}>
                <SelectTrigger className="flex-1">
                  <SelectValue>
                    {category === "all" 
                      ? "전체 카테고리" 
                      : (["REVIEW", "REVISION", "CONTRACT", "SPECIFICATION", "APPLICATION"] as CategoryParam[]).find(c => c === category) === "REVIEW" ? "검토"
                      : (["REVIEW", "REVISION", "CONTRACT", "SPECIFICATION", "APPLICATION"] as CategoryParam[]).find(c => c === category) === "REVISION" ? "수정"
                      : (["REVIEW", "REVISION", "CONTRACT", "SPECIFICATION", "APPLICATION"] as CategoryParam[]).find(c => c === category) === "CONTRACT" ? "계약"
                      : (["REVIEW", "REVISION", "CONTRACT", "SPECIFICATION", "APPLICATION"] as CategoryParam[]).find(c => c === category) === "SPECIFICATION" ? "명세서"
                      : (["REVIEW", "REVISION", "CONTRACT", "SPECIFICATION", "APPLICATION"] as CategoryParam[]).find(c => c === category) === "APPLICATION" ? "출원"
                      : "전체"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(["all", "REVIEW", "REVISION", "CONTRACT", "SPECIFICATION", "APPLICATION"] as CategoryParam[]).map((categoryValue) => {
                    const categoryLabels: Record<CategoryParam, string> = {
                      all: "전체",
                      REVIEW: "검토",
                      REVISION: "수정",
                      CONTRACT: "계약",
                      SPECIFICATION: "명세서",
                      APPLICATION: "출원",
                    };
                    const filteredByStatus = status === "all"
                      ? searchedSelfTasks
                      : (() => {
                          const statusMap: Record<StatusParam, TaskStatus | null> = {
                            all: null,
                            assigned: "ASSIGNED",
                            in_progress: "IN_PROGRESS",
                            waiting_confirm: "WAITING_CONFIRM",
                            rejected: "REJECTED",
                            approved: "APPROVED",
                          };
                          // 카테고리 필터는 기준이므로 상태/이메일 필터 및 검색어의 영향을 받지 않음
                          return selfTasks;
                        })();
                    // 카테고리 필터는 기준이므로 상태/이메일 필터 및 검색어의 영향을 받지 않음
                    const count = categoryValue === "all"
                      ? selfTasks.length
                      : selfTasks.filter((task) => task.task_category === categoryValue).length;
                    return (
                      <SelectItem key={categoryValue} value={categoryValue}>
                        {categoryLabels[categoryValue]} ({count}개)
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={(value) => handleSelfTasksStatusChange(value as StatusParam)}>
                <SelectTrigger className="flex-1">
                  <SelectValue>
                    {status === "all" 
                      ? "전체 상태" 
                      : status === "in_progress" ? "진행중"
                      : status === "approved" ? "승인됨"
                      : "전체"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(["all", "in_progress", "approved"] as StatusParam[]).map((statusValue) => {
                    const statusLabels: Record<StatusParam, string> = {
                      all: "전체",
                      assigned: "할당됨",
                      in_progress: "진행중",
                      waiting_confirm: "확인대기",
                      rejected: "거부됨",
                      approved: "승인됨",
                    };
                    const filteredByCategory = category === "all"
                      ? searchedSelfTasks
                      : searchedSelfTasks.filter((task) => task.task_category === category);
                    const statusMap: Record<StatusParam, TaskStatus | null> = {
                      all: null,
                      assigned: "ASSIGNED",
                      in_progress: "IN_PROGRESS",
                      waiting_confirm: "WAITING_CONFIRM",
                      rejected: "REJECTED",
                      approved: "APPROVED",
                    };
                    const dbStatus = statusMap[statusValue];
                    const count = dbStatus === null 
                      ? filteredByCategory.length
                      : filteredByCategory.filter((task) => task.task_status === dbStatus).length;
                    return (
                      <SelectItem key={statusValue} value={statusValue}>
                        {statusLabels[statusValue]} ({count}개)
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Select value={emailSent} onValueChange={(value) => handleSelfTasksEmailSentChange(value as EmailSentParam)}>
                <SelectTrigger className="flex-1">
                  <SelectValue>
                    {emailSent === "all" 
                      ? "전체 이메일" 
                      : emailSent === "sent" ? "전송완료"
                      : emailSent === "not_sent" ? "미전송"
                      : "전체"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(["all", "sent", "not_sent"] as EmailSentParam[]).map((emailSentValue) => {
                    const emailSentLabels: Record<EmailSentParam, string> = {
                      all: "전체",
                      sent: "전송완료",
                      not_sent: "미전송",
                    };
                    const filteredByCategory = category === "all"
                      ? searchedSelfTasks
                      : searchedSelfTasks.filter((task) => task.task_category === category);
                    const filteredByStatus = status === "all"
                      ? filteredByCategory
                      : (() => {
                          const statusMap: Record<StatusParam, TaskStatus | null> = {
                            all: null,
                            assigned: "ASSIGNED",
                            in_progress: "IN_PROGRESS",
                            waiting_confirm: "WAITING_CONFIRM",
                            rejected: "REJECTED",
                            approved: "APPROVED",
                          };
                          const dbStatus = statusMap[status];
                          return dbStatus === null
                            ? filteredByCategory
                            : filteredByCategory.filter((task) => task.task_status === dbStatus);
                        })();
                    const count = emailSentValue === "all"
                      ? filteredByStatus.length
                      : emailSentValue === "sent"
                      ? filteredByStatus.filter((task) => task.send_email_to_client === true).length
                      : filteredByStatus.filter((task) => task.send_email_to_client === false).length;
                    return (
                      <SelectItem key={emailSentValue} value={emailSentValue}>
                        {emailSentLabels[emailSentValue]} ({count}개)
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* 데스크톱: 필터 버튼 */}
            <div className="hidden flex-col gap-2 sm:flex">
              <div className="flex flex-wrap gap-2">
                {(["all", "REVIEW", "REVISION", "CONTRACT", "SPECIFICATION", "APPLICATION"] as CategoryParam[]).map((categoryValue) => {
                  const categoryLabels: Record<CategoryParam, string> = {
                    all: "전체",
                    REVIEW: "검토",
                    REVISION: "수정",
                    CONTRACT: "계약",
                    SPECIFICATION: "명세서",
                    APPLICATION: "출원",
                  };
                  // 카테고리 필터는 기준이므로 상태/이메일 필터 및 검색어의 영향을 받지 않음
                  const count = categoryValue === "all"
                    ? selfTasks.length
                    : selfTasks.filter((task) => task.task_category === categoryValue).length;
                  return (
                    <Button
                      key={categoryValue}
                      variant={category === categoryValue ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleSelfTasksCategoryChange(categoryValue)}
                      className="p-1 sm:p-1.5"
                    >
                      {categoryLabels[categoryValue]} ({count}개)
                    </Button>
                  );
                })}
              </div>
              {/* 상태 필터 버튼 */}
              <div className="flex flex-wrap gap-2">
                {(["all", "in_progress", "approved"] as StatusParam[]).map((statusValue) => {
                  const statusLabels: Record<StatusParam, string> = {
                    all: "전체",
                    assigned: "할당됨",
                    in_progress: "진행중",
                    waiting_confirm: "확인대기",
                    rejected: "거부됨",
                    approved: "승인됨",
                  };
                  const filteredByCategory = category === "all"
                    ? searchedSelfTasks
                    : searchedSelfTasks.filter((task) => task.task_category === category);
                  const filteredByEmailSent = emailSent === "all"
                    ? filteredByCategory
                    : emailSent === "sent"
                    ? filteredByCategory.filter((task) => task.send_email_to_client === true)
                    : filteredByCategory.filter((task) => task.send_email_to_client === false);
                  const statusMap: Record<StatusParam, TaskStatus | null> = {
                    all: null,
                    assigned: "ASSIGNED",
                    in_progress: "IN_PROGRESS",
                    waiting_confirm: "WAITING_CONFIRM",
                    rejected: "REJECTED",
                    approved: "APPROVED",
                  };
                  const dbStatus = statusMap[statusValue];
                  const count = dbStatus === null 
                    ? filteredByEmailSent.length
                    : filteredByEmailSent.filter((task) => task.task_status === dbStatus).length;
                  
                  return (
                    <Button
                      key={statusValue}
                      variant={status === statusValue ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleSelfTasksStatusChange(statusValue)}
                      className="p-1 sm:p-1.5"
                    >
                      {statusLabels[statusValue]} ({count}개)
                    </Button>
                  );
                })}
              </div>
              {/* 이메일 발송 필터 버튼 */}
              <div className="flex flex-wrap gap-2">
                {(["all", "sent", "not_sent"] as EmailSentParam[]).map((emailSentValue) => {
                  const emailSentLabels: Record<EmailSentParam, string> = {
                    all: "전체",
                    sent: "전송완료",
                    not_sent: "미전송",
                  };
                  const filteredByCategory = category === "all"
                    ? searchedSelfTasks
                    : searchedSelfTasks.filter((task) => task.task_category === category);
                  const filteredByStatus = status === "all"
                    ? filteredByCategory
                    : (() => {
                        const statusMap: Record<StatusParam, TaskStatus | null> = {
                          all: null,
                          assigned: "ASSIGNED",
                          in_progress: "IN_PROGRESS",
                          waiting_confirm: "WAITING_CONFIRM",
                          rejected: "REJECTED",
                          approved: "APPROVED",
                        };
                        const dbStatus = statusMap[status];
                        return dbStatus === null
                          ? filteredByCategory
                          : filteredByCategory.filter((task) => task.task_status === dbStatus);
                      })();
                  const count = emailSentValue === "all"
                    ? filteredByStatus.length
                    : emailSentValue === "sent"
                    ? filteredByStatus.filter((task) => task.send_email_to_client === true).length
                    : filteredByStatus.filter((task) => task.send_email_to_client === false).length;
                  
                  return (
                    <Button
                      key={emailSentValue}
                      variant={emailSent === emailSentValue ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleSelfTasksEmailSentChange(emailSentValue)}
                      className="p-1 sm:p-1.5"
                    >
                      {emailSentLabels[emailSentValue]} ({count}개)
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
          {/* 검색창 */}
          <div className="w-full">
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="고유 ID, 고객명, 지시사항으로 검색하세요..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          {/* Task 테이블 */}
          <div className="overflow-x-scroll">
            <table className="w-full min-w-[800px] table-fixed">
              <thead>
                <tr className="border-b">
                  <th className="w-[16.666%] px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm">
                    고유 ID
                  </th>
                  <th className="w-[16.666%] px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm">
                    고객명
                  </th>
                  <th className="w-[16.666%] px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm">
                    지시사항
                  </th>
                  <th
                    className="hover:bg-muted/50 w-[16.666%] cursor-pointer px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm"
                    onClick={handleSelfTasksSortDueChange}
                  >
                    <div className="flex items-center gap-2">
                      마감일
                      <ArrowUpDown className="size-3 sm:size-4" />
                    </div>
                  </th>
                  <th className="w-[16.666%] px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm">
                    상태
                  </th>
                  <th className="w-[16.666%] px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm">
                    이메일 전송 상태
                  </th>
                </tr>
              </thead>
              <tbody>
                {selfTasksLoading ? (
                  <tr>
                    <td colSpan={6} className="px-2 py-8 text-center sm:px-4">
                      <DefaultSpinner />
                    </td>
                  </tr>
                ) : paginatedSelfTasks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-2 py-8 text-center text-muted-foreground sm:px-4">
                      {(debouncedSearch || category !== "all" || status !== "all" || emailSent !== "all") ? "조건에 맞는 업무가 없습니다." : "업무가 없습니다."}
                    </td>
                  </tr>
                ) : (
                  paginatedSelfTasks.map((task) => {
                    const dueDate = task.due_date ? formatDateKorean(task.due_date) : null;
                    const daysDiff = calculateDaysDifference(task.due_date);
                    const dDayText = getDDayText(daysDiff);
                    const dueDateColorClass = getDueDateColorClass(daysDiff, task.task_status);
                    const uniqueId = task.id.slice(0, 8).toUpperCase();

                    return (
                      <tr
                        key={task.id}
                        className="hover:bg-muted/50 border-b transition-colors cursor-pointer"
                        onClick={() => {
                          const currentUrl =
                            window.location.pathname + window.location.search;
                          sessionStorage.setItem("previousDashboardUrl", currentUrl);
                          navigate(`/tasks/${task.id}`);
                        }}
                      >
                        <td className="px-2 py-3 sm:px-4 sm:py-4">
                          <Link
                            to={`/tasks/${task.id}`}
                            className="text-primary hover:underline text-xs sm:text-sm font-mono"
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            {uniqueId}
                          </Link>
                        </td>
                        <td className="px-2 py-3 sm:px-4 sm:py-4">
                          <div className="line-clamp-2 text-xs sm:text-sm">{task.client_name || "-"}</div>
                        </td>
                        <td className="px-2 py-3 sm:px-4 sm:py-4">
                          <div className="line-clamp-2">
                            <Link
                              to={`/tasks/${task.id}`}
                              className="text-primary hover:underline text-xs sm:text-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                            >
                              {task.title}
                            </Link>
                          </div>
                        </td>
                        <td className="px-2 py-3 sm:px-4 sm:py-4">
                          {dueDate ? (
                            <span
                              className={cn(
                                "text-xs whitespace-nowrap sm:text-sm",
                                dueDateColorClass,
                              )}
                            >
                              {dueDate} {dDayText}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs sm:text-sm">-</span>
                          )}
                        </td>
                        <td className="px-2 py-3 sm:px-4 sm:py-4">
                          <TaskStatusBadge status={task.task_status} />
                        </td>
                        <td className="px-2 py-3 sm:px-4 sm:py-4">
                          {task.task_status === "IN_PROGRESS" ? (
                            <span className="text-muted-foreground text-xs sm:text-sm">-</span>
                          ) : (
                            (() => {
                              const isAssignee = task.assignee_id === currentProfile?.id;
                              const isReference = task.references?.some((ref) => ref.id === currentProfile?.id) ?? false;
                              const canEdit = isAssignee || isReference;
                              return (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEmailSentToggle(task, e);
                                  }}
                                  disabled={!canEdit || updateTask.isPending}
                                  className={cn(
                                    "flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors",
                                    "hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50",
                                    canEdit && "cursor-pointer"
                                  )}
                                >
                                  {task.send_email_to_client ? (
                                    <>
                                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" />
                                      <span className="text-xs sm:text-sm whitespace-nowrap">전송 완료</span>
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="h-4 w-4 text-muted-foreground" />
                                      <span className="text-xs sm:text-sm">미전송</span>
                                    </>
                                  )}
                                </button>
                              );
                            })()
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {sortedSelfTasks.length > 0 && (
            <TablePagination
              currentPage={selfTasksCurrentPage}
              totalPages={selfTasksTotalPages}
              pageSize={selfTasksItemsPerPage}
              totalItems={sortedSelfTasks.length}
              selectedCount={0}
              onPageChange={(page) => {
                updateSelfTasksUrlParams({ selfTasksPage: page });
              }}
              onPageSizeChange={(newPageSize) => {
                setSelfTasksItemsPerPage(newPageSize);
                sessionStorage.setItem("tablePageSize", newPageSize.toString());
                updateSelfTasksUrlParams({ selfTasksPage: 1 });
              }}
            />
          )}
        </TabsContent>

        {/* 참조된 업무 탭 */}
        <TabsContent value="reference-tasks" className="space-y-4">
          {referenceTasksLoading ? (
            <DefaultSpinner />
          ) : (
            <div className="space-y-4">
              {/* 필터 영역 (담당 업무 탭과 동일) */}
              <div className="space-y-3">
                {/* 모바일: Select 드롭다운 */}
                <div className="flex gap-2 sm:hidden">
                  <Select value={referenceCategory} onValueChange={(value) => handleReferenceTasksCategoryChange(value as CategoryParam)}>
                    <SelectTrigger className="flex-1">
                      <SelectValue>
                        {referenceCategory === "all"
                          ? "전체 카테고리"
                          : referenceCategory === "REVIEW"
                            ? "검토"
                            : referenceCategory === "REVISION"
                              ? "수정"
                              : referenceCategory === "CONTRACT"
                                ? "계약"
                                : referenceCategory === "SPECIFICATION"
                                  ? "명세서"
                                  : referenceCategory === "APPLICATION"
                                    ? "출원"
                                    : "전체"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(["all", "REVIEW", "REVISION", "CONTRACT", "SPECIFICATION", "APPLICATION"] as CategoryParam[]).map((categoryValue) => {
                        const categoryLabels: Record<CategoryParam, string> = {
                          all: "전체",
                          REVIEW: "검토",
                          REVISION: "수정",
                          CONTRACT: "계약",
                          SPECIFICATION: "명세서",
                          APPLICATION: "출원",
                        };
                        // 카테고리 필터는 기준이므로 상태 필터 및 검색어의 영향을 받지 않음
                        const count =
                          categoryValue === "all"
                            ? referenceTasks.filter((task) => task.task_status !== "APPROVED").length
                            : referenceTasks.filter((task) => task.task_status !== "APPROVED" && task.task_category === categoryValue).length;
                        return (
                          <SelectItem key={categoryValue} value={categoryValue}>
                            {categoryLabels[categoryValue]} ({count}개)
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <Select value={referenceStatus} onValueChange={(value) => handleReferenceTasksStatusChange(value as StatusParam)}>
                    <SelectTrigger className="flex-1">
                      <SelectValue>
                        {referenceStatus === "all"
                          ? "전체 상태"
                          : referenceStatus === "assigned"
                            ? "할당됨"
                            : referenceStatus === "in_progress"
                              ? "진행중"
                              : referenceStatus === "waiting_confirm"
                                ? "확인대기"
                                : referenceStatus === "rejected"
                                  ? "거부됨"
                                  : "전체"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(["all", "assigned", "in_progress", "waiting_confirm", "rejected"] as StatusParam[]).map((statusValue) => {
                        const statusLabels: Record<StatusParam, string> = {
                          all: "전체",
                          assigned: "할당됨",
                          in_progress: "진행중",
                          waiting_confirm: "확인대기",
                          rejected: "거부됨",
                          approved: "승인됨",
                        };
                        const filteredByCategory =
                          referenceCategory === "all"
                            ? searchedReferenceTasks
                            : searchedReferenceTasks.filter((task) => task.task_category === referenceCategory);
                        const dbStatus = statusMap[statusValue];
                        const count =
                          dbStatus === null
                            ? filteredByCategory.filter((task) => task.task_status !== "APPROVED").length
                            : filteredByCategory.filter((task) => task.task_status === dbStatus).length;
                        return (
                          <SelectItem key={statusValue} value={statusValue}>
                            {statusLabels[statusValue]} ({count}개)
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                {/* 태블릿/PC: 버튼 그룹 */}
                <div className="hidden sm:block space-y-2">
                  {/* 카테고리 필터 버튼 */}
                  <div className="flex flex-wrap gap-2">
                    {(["all", "REVIEW", "REVISION", "CONTRACT", "SPECIFICATION", "APPLICATION"] as CategoryParam[]).map((categoryValue) => {
                      const categoryLabels: Record<CategoryParam, string> = {
                        all: "전체",
                        REVIEW: "검토",
                        REVISION: "수정",
                        CONTRACT: "계약",
                        SPECIFICATION: "명세서",
                        APPLICATION: "출원",
                      };
                      // 카테고리 필터는 기준이므로 상태 필터 및 검색어의 영향을 받지 않음
                      const count =
                        categoryValue === "all"
                          ? referenceTasks.filter((task) => task.task_status !== "APPROVED").length
                          : referenceTasks.filter((task) => task.task_status !== "APPROVED" && task.task_category === categoryValue).length;
                      return (
                        <Button
                          key={categoryValue}
                          variant={referenceCategory === categoryValue ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleReferenceTasksCategoryChange(categoryValue)}
                          className="p-1 sm:p-1.5"
                        >
                          {categoryLabels[categoryValue]} ({count}개)
                        </Button>
                      );
                    })}
                  </div>
                  {/* 상태 필터 버튼 */}
                  <div className="flex flex-wrap gap-2">
                    {(["all", "assigned", "in_progress", "waiting_confirm", "rejected"] as StatusParam[]).map((statusValue) => {
                      const statusLabels: Record<StatusParam, string> = {
                        all: "전체",
                        assigned: "할당됨",
                        in_progress: "진행중",
                        waiting_confirm: "확인대기",
                        rejected: "거부됨",
                        approved: "승인됨",
                      };
                      const filteredByCategory =
                        referenceCategory === "all"
                          ? searchedReferenceTasks
                          : searchedReferenceTasks.filter((task) => task.task_category === referenceCategory);
                      const dbStatus = statusMap[statusValue];
                      const count =
                        dbStatus === null
                          ? filteredByCategory.filter((task) => task.task_status !== "APPROVED").length
                          : filteredByCategory.filter((task) => task.task_status === dbStatus).length;
                      return (
                        <Button
                          key={statusValue}
                          variant={referenceStatus === statusValue ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleReferenceTasksStatusChange(statusValue)}
                          className="p-1 sm:p-1.5"
                        >
                          {statusLabels[statusValue]} ({count}개)
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>
              {/* 검색창 및 안 읽은 메시지 필터 */}
              <div className="flex gap-2 w-full">
                <div className="relative flex-1">
                  <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                  <Input
                    placeholder="고유 ID, 고객명, 지시사항, 지시자/담당자명으로 검색하세요..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={messageFilter} onValueChange={(value) => handleMessageFilterChange(value as MessageFilterParam)}>
                  <SelectTrigger className="min-w-45">
                    <SelectValue>
                      {messageFilter === "not-read" ? "메시지를 읽지 않은 업무" : "전체"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    <SelectItem value="not-read">메시지를 읽지 않은 업무</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Task 테이블 */}
              <div className="overflow-x-scroll">
                <table className="w-full min-w-[800px] table-fixed">
                  <thead>
                    <tr className="border-b">
                      <th className="w-[14.285%] px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm">고유 ID</th>
                      <th className="w-[14.285%] px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm">고객명</th>
                      <th className="w-[14.285%] px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm">지시사항</th>
                      <th
                        className="hover:bg-muted/50 w-[14.285%] cursor-pointer px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm"
                        onClick={() => {
                          const newSortDue: SortDueParam = sortDue === "asc" ? "desc" : "asc";
                          updateReferenceTasksUrlParams({ sortDue: newSortDue, referenceTasksPage: 1 });
                        }}
                      >
                        <div className="flex items-center gap-2">
                          마감일
                          <ArrowUpDown className="size-3 sm:size-4" />
                        </div>
                      </th>
                      <th className="w-[14.285%] px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm">
                        <StatusFilterDropdown
                          status={referenceStatus}
                          onStatusChange={handleReferenceTasksStatusChange}
                          tasks={categoryFilteredReferenceTasks}
                          hideApproved={true}
                        />
                      </th>
                      <th className="w-[14.285%] px-2 py-3 text-center text-xs font-medium sm:px-4 sm:text-sm">새 메시지</th>
                      <th className="w-[14.285%] px-2 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm">지시자/담당자</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedReferenceTasks.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="text-muted-foreground h-24 text-center text-xs sm:text-sm"
                        >
                          {(debouncedSearch || referenceCategory !== "all" || referenceStatus !== "all") ? "조건에 맞는 업무가 없습니다." : "업무가 없습니다."}
                        </td>
                      </tr>
                    ) : (
                      paginatedReferenceTasks.map((task) => {
                        const dueDate = formatDueDate(task.due_date);
                        const daysDiff = calculateDaysDifference(task.due_date);
                        const dDayText = getDDayText(daysDiff);
                        const dueDateColorClass = getDueDateColorClass(daysDiff, task.task_status);
                        const assignerName = task.assigner?.full_name || task.assigner?.email?.split("@")[0] || "-";
                        const assigneeName = task.assignee?.full_name || task.assignee?.email?.split("@")[0] || "-";
                        const assignerAssigneeDisplay = `${assignerName} / ${assigneeName}`;
                        return (
                          <tr
                            key={task.id}
                            className="hover:bg-muted/50 border-b transition-colors cursor-pointer"
                            onClick={() => {
                              const currentUrl = window.location.pathname + window.location.search;
                              sessionStorage.setItem("previousDashboardUrl", currentUrl);
                              navigate(`/tasks/${task.id}`);
                            }}
                          >
                            <td className="px-2 py-3 sm:px-4 sm:py-4">
                              <div className="line-clamp-2 text-xs sm:text-sm">
                                {task.id ? (
                                  <span className="font-mono text-xs text-primary">{task.id.slice(0, 8).toUpperCase()}</span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-3 sm:px-4 sm:py-4">
                              <div className="line-clamp-2 text-xs sm:text-sm">
                                {task.client_name || <span className="text-muted-foreground">-</span>}
                              </div>
                            </td>
                            <td className="px-2 py-3 sm:px-4 sm:py-4">
                              <div className="line-clamp-2 text-xs sm:text-sm">
                                <Link
                                  to={`/tasks/${task.id}`}
                                  className="line-clamp-2 hover:underline cursor-pointer text-primary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const currentUrl = window.location.pathname + window.location.search;
                                    sessionStorage.setItem("previousDashboardUrl", currentUrl);
                                  }}
                                >
                                  {task.title}
                                </Link>
                              </div>
                            </td>
                            <td className="px-2 py-3 sm:px-4 sm:py-4">
                              {dueDate ? (
                                <span
                                  className={cn(
                                    "text-xs whitespace-nowrap sm:text-sm",
                                    dueDateColorClass,
                                  )}
                                >
                                  {dueDate} {dDayText}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-xs sm:text-sm">-</span>
                              )}
                            </td>
                            <td className="px-2 py-3 sm:px-4 sm:py-4">
                              <TaskStatusBadge status={task.task_status} />
                            </td>
                            <td className="px-2 py-3 text-center sm:px-4 sm:py-4">
                              {task.unread_message_count && task.unread_message_count > 0 ? (
                                <div className="relative inline-flex">
                                  <Bell className="h-6 w-6" style={{ fill: "oklch(0.637 0.237 25.331)", color: "oklch(0.637 0.237 25.331)" }} />
                                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-semibold text-white">
                                    {task.unread_message_count}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs sm:text-sm">-</span>
                              )}
                            </td>
                            <td className="px-2 py-3 sm:px-4 sm:py-4">
                              <div className="line-clamp-2 text-xs sm:text-sm">{assignerAssigneeDisplay}</div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {/* 페이지네이션 */}
              {sortedReferenceTasks.length > 0 && (
                <TablePagination
                  currentPage={referenceTasksCurrentPage}
                  totalPages={referenceTasksTotalPages}
                  pageSize={referenceTasksItemsPerPage}
                  totalItems={sortedReferenceTasks.length}
                  selectedCount={0}
                  onPageChange={(page) => {
                    updateReferenceTasksUrlParams({ referenceTasksPage: page });
                  }}
                  onPageSizeChange={(newPageSize) => {
                    setReferenceTasksItemsPerPage(newPageSize);
                    sessionStorage.setItem("tablePageSize", newPageSize.toString());
                    updateReferenceTasksUrlParams({ referenceTasksPage: 1 });
                  }}
                />
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* 상태 변경 확인 다이얼로그 */}
      {pendingStatusChange && (
        <TaskStatusChangeDialog
          open={statusChangeDialogOpen}
          onOpenChange={setStatusChangeDialogOpen}
          currentStatus={pendingStatusChange.currentStatus}
          newStatus={pendingStatusChange.newStatus}
          taskTitle={pendingStatusChange.taskTitle}
          onConfirm={handleConfirmStatusChange}
          isLoading={updateTaskStatus.isPending}
        />
      )}

      {/* 태스크 생성 다이얼로그 */}
      <TaskFormDialog
        open={createTaskDialogOpen}
        onOpenChange={(open) => {
          setCreateTaskDialogOpen(open);
          if (!open) {
            setPreSelectedCategory(undefined);
            setAutoFillMode(undefined);
            setPreFilledTitle(undefined);
            setIsSpecificationMode(false);
          }
        }}
        onSubmit={handleCreateTask}
        isLoading={isCreatingTask || createTask.isPending || createMessageWithFiles.isPending}
        preSelectedCategory={preSelectedCategory}
        autoFillMode={autoFillMode}
        preFilledTitle={preFilledTitle}
        isSpecificationMode={isSpecificationMode}
        defaultSelfTask={activeTab === "self-tasks"}
      />
    </div>
  );
}


/**
 * 이메일 발송 필터 드롭다운 컴포넌트
 */
function EmailSentFilterDropdown({
  emailSent,
  onEmailSentChange,
  tasks,
}: {
  emailSent: EmailSentParam;
  onEmailSentChange: (emailSent: EmailSentParam) => void;
  tasks: TaskWithProfiles[];
}) {
  const emailSentLabels: Record<EmailSentParam, string> = {
    all: "전체",
    sent: "전송완료",
    not_sent: "미전송",
  };

  // 각 상태별 개수 계산
  const getEmailSentCount = (emailSentValue: EmailSentParam): number => {
    if (emailSentValue === "all") {
      return tasks.length;
    } else if (emailSentValue === "sent") {
      return tasks.filter((task) => task.send_email_to_client === true).length;
    } else {
      // not_sent
      return tasks.filter((task) => task.send_email_to_client === false).length;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 px-2">
          <span className="font-medium">{emailSentLabels[emailSent]}</span>
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {(Object.keys(emailSentLabels) as EmailSentParam[]).map((emailSentValue) => {
          const count = getEmailSentCount(emailSentValue);
          return (
            <DropdownMenuItem
              key={emailSentValue}
              onClick={() => onEmailSentChange(emailSentValue)}
              className={emailSent === emailSentValue ? "bg-accent" : ""}
            >
              {emailSentLabels[emailSentValue]} ({count}개)
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * 상태 필터 드롭다운 컴포넌트
 */
function StatusFilterDropdown({
  status,
  onStatusChange,
  tasks,
  hideApproved = false,
}: {
  status: StatusParam;
  onStatusChange: (status: StatusParam) => void;
  tasks: TaskWithProfiles[];
  hideApproved?: boolean;
}) {
  const statusLabels: Record<StatusParam, string> = {
    all: "전체",
    assigned: "할당됨",
    in_progress: "진행중",
    waiting_confirm: "확인대기",
    rejected: "거부됨",
    approved: "승인됨",
  };

  const statusMap: Record<StatusParam, TaskStatus | null> = {
    all: null,
    assigned: "ASSIGNED",
    in_progress: "IN_PROGRESS",
    waiting_confirm: "WAITING_CONFIRM",
    rejected: "REJECTED",
    approved: "APPROVED",
  };

  // 각 상태별 개수 계산
  const getStatusCount = (statusValue: StatusParam): number => {
    if (statusValue === "all") {
      // 전체는 승인됨 제외
      return tasks.filter((task) => task.task_status !== "APPROVED").length;
    }
    const dbStatus = statusMap[statusValue];
    return tasks.filter((task) => task.task_status === dbStatus).length;
  };

  // 표시할 상태 목록 필터링
  const visibleStatuses = (Object.keys(statusLabels) as StatusParam[]).filter(
    (statusValue) => !hideApproved || statusValue !== "approved"
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 px-2">
          <span className="font-medium">{statusLabels[status]}</span>
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {visibleStatuses.map((statusValue) => {
          const count = getStatusCount(statusValue);
          return (
            <DropdownMenuItem
              key={statusValue}
              onClick={() => onStatusChange(statusValue)}
              className={status === statusValue ? "bg-accent" : ""}
            >
              {statusLabels[statusValue]} ({count}개)
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
