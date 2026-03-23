import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import {
  ArrowLeft,
  Play,
  CheckCircle,
  XCircle,
  Pencil,
  Trash2,
  Paperclip,
  Send,
  Download,
  File,
  X,
  Plus,
  Info,
  AlertTriangle,
  MoreVertical,
  Copy,
  RotateCcw,
  ListPlus,
  Share2,
  ListFilterPlus,
  HeartPlus,
  Mail,
} from "lucide-react";
import {
  useTask,
  useIsAdmin,
  useUpdateTask,
  useUpdateTaskStatus,
  useDeleteTask,
  useCurrentProfile,
  useMessages,
  useCreateMessage,
  useCreateFileMessage,
  useCreateMessageWithFiles,
  useMarkTaskMessagesAsRead,
  useRealtimeMessages,
  useChatPresence,
  useDeleteMessage,
  useChatLogs,
  useRealtimeChatLogs,
} from "@/hooks";
import { TaskStatusBadge } from "@/components/common/task-status-badge";
import { ChatLogGroup } from "@/components/task/chat-log-group";
import { TaskDetailDialog } from "@/components/task/task-detail-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Spinner } from "@/components/ui/spinner";
import DefaultSpinner from "@/components/common/default-spinner";
import { TaskFormDialog } from "@/components/task/task-form-dialog";
import { TaskDeleteDialog } from "@/components/task/task-delete-dialog";
import { TaskStatusChangeDialog } from "@/components/dialog/task-status-change-dialog";
import { TaskForceApproveDialog } from "@/components/dialog/task-force-approve-dialog";
import { MessageDeleteDialog } from "@/components/dialog/message-delete-dialog";
import { AddToListDialog } from "@/components/task-list/add-to-list-dialog";
import { ProfileAvatar } from "@/components/common/profile-avatar";
import { LinkPreviewCard } from "@/components/message/link-preview-card";
import { TaskShareDialog } from "@/components/task/task-share-dialog";
import { ConfirmEmailDialog } from "@/components/dialog/confirm-email-dialog";
import type { TaskCreateFormData, TaskCreateSelfTaskFormData, TaskCreateSpecificationFormData, TaskUpdateFormData } from "@/schemas/task/task-schema";
import type { TaskStatus } from "@/lib/task-status";
import type { ChatLogWithItems, MessageWithProfile } from "@/api/message";
import { getUnreadCountForMessageFromData } from "@/api/message";
import { uploadTaskFile, getTaskFileDownloadUrl } from "@/api/storage";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import supabase from "@/lib/supabase";

/**
 * Task 상세 페이지
 */
export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { data: task, isLoading, error } = useTask(taskId);
  const { data: currentProfile } = useCurrentProfile();
  const { data: isAdmin = false } = useIsAdmin();
  const { data: messages = [], isLoading: messagesLoading } = useMessages(taskId);
  const { data: chatLogs = [], isLoading: logsLoading } = useChatLogs(taskId);
  const createMessage = useCreateMessage();
  const createFileMessage = useCreateFileMessage();
  const createMessageWithFiles = useCreateMessageWithFiles();
  const markMessagesAsRead = useMarkTaskMessagesAsRead();
  const updateTask = useUpdateTask();
  const updateTaskStatus = useUpdateTaskStatus();
  const deleteTask = useDeleteTask();
  const deleteMessage = useDeleteMessage();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [statusChangeDialogOpen, setStatusChangeDialogOpen] = useState(false);
  const [pendingNewStatus, setPendingNewStatus] = useState<TaskStatus | null>(null);
  const [forceApproveDialogOpen, setForceApproveDialogOpen] = useState(false);
  const [isForceApproving, setIsForceApproving] = useState(false);
  const [messageDeleteDialogOpen, setMessageDeleteDialogOpen] = useState(false);
  const [pendingDeleteMessage, setPendingDeleteMessage] = useState<MessageWithProfile | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]); // Draft 상태의 파일들
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set()); // 업로드 중인 파일 이름들
  const [dragActive, setDragActive] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [openMenuMessageId, setOpenMenuMessageId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [addToListDialogOpen, setAddToListDialogOpen] = useState(false);
  const [confirmEmailDialogOpen, setConfirmEmailDialogOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevIsPresentRef = useRef<boolean>(false); // 이전 Presence 상태 추적
  const lastMarkAsReadTimeRef = useRef<number>(0); // 마지막 읽음 처리 시간 (중복 호출 방지용)
  const prevMessagesLengthRef = useRef<number>(0); // 이전 메시지 개수 추적 (스크롤 제어용)
  const isUserNearBottomRef = useRef<boolean>(true); // 최하단 근처에 있으면 새 메시지 시 자동 스크롤
  const SCROLL_NEAR_BOTTOM_THRESHOLD = 100; // px

  const currentUserId = currentProfile?.id;
  const queryClient = useQueryClient();

  // Presence 추적 (채팅 화면에 사용자가 존재함을 실시간으로 추적)
  const { isPresent } = useChatPresence(taskId, !!taskId);

  // Realtime 구독 활성화 (Presence 상태 전달)
  useRealtimeMessages(taskId, !!taskId, isPresent);

  // 채팅 로그 리얼타임 구독 활성화
  useRealtimeChatLogs(taskId, !!taskId);

  // 케이스 1: 초기 로드 시 읽음 처리 (taskId 변경 또는 Presence 활성화 시)
  // Presence가 활성화되면 즉시 읽음 처리 (채널 구독 비동기 완료 후 isPresent=true)
  useEffect(() => {
    if (taskId && currentUserId && isPresent) {
      const now = Date.now();
      if (now - lastMarkAsReadTimeRef.current > 1000) {
        lastMarkAsReadTimeRef.current = now;
        markMessagesAsRead.mutate(taskId, {
          onSuccess: () => {},
          onError: (error) => {
            console.error(`[TaskDetail] ❌ Case 1: Failed to mark messages as read:`, error);
            lastMarkAsReadTimeRef.current = 0;
          },
        });
      }
    }
  }, [taskId, currentUserId, isPresent, markMessagesAsRead]);

  // 케이스 2: 채팅 화면 재진입 시 읽음 처리 (Presence false → true 전환)
  useEffect(() => {
    if (taskId && currentUserId && isPresent && !prevIsPresentRef.current) {
      // Presence가 false → true로 전환된 경우 (재진입)
      const now = Date.now();
      // 1초 이내 중복 호출 방지
      if (now - lastMarkAsReadTimeRef.current > 1000) {
        lastMarkAsReadTimeRef.current = now;
        markMessagesAsRead.mutate(taskId, {
          onSuccess: () => {},
          onError: (error) => {
            console.error(`[TaskDetail] ❌ Case 2: Failed to mark messages as read:`, error);
            lastMarkAsReadTimeRef.current = 0; // 에러 발생 시 시간 리셋하여 재시도 가능하도록
          },
        });
      }
    }
    // 이전 Presence 상태 업데이트
    prevIsPresentRef.current = isPresent;
  }, [taskId, currentUserId, isPresent, markMessagesAsRead]);

  // taskId 변경 시 ref 리셋
  useEffect(() => {
    prevIsPresentRef.current = false;
    lastMarkAsReadTimeRef.current = 0;
  }, [taskId]);

  // 스크롤 시 하단 근처 여부 추적 (새 메시지 시 자동 스크롤 여부 결정)
  const handleChatScroll = useCallback(() => {
    const el = chatScrollContainerRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    isUserNearBottomRef.current = distanceFromBottom <= SCROLL_NEAR_BOTTOM_THRESHOLD;
  }, []);

  // 새 메시지 수신 시 스크롤 하단으로 이동
  // - 본인이 보낸 메시지: 항상 스크롤
  // - 상대가 보낸 메시지: 하단 근처에 있을 때만 스크롤 (위로 스크롤해 과거 읽는 중이면 그대로)
  useEffect(() => {
    if (!currentUserId || messages.length === 0) {
      prevMessagesLengthRef.current = messages.length;
      return;
    }

    // 메시지가 새로 추가된 경우만 확인
    if (messages.length > prevMessagesLengthRef.current) {
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage) {
        prevMessagesLengthRef.current = messages.length;
        return;
      }
      const isMyMessage = lastMessage.user_id === currentUserId;
      const shouldScroll =
        isMyMessage || (isUserNearBottomRef.current && !isMyMessage);
      if (shouldScroll) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }

    // 이전 메시지 개수 업데이트
    prevMessagesLengthRef.current = messages.length;
  }, [messages, currentUserId]);

  // 마지막 로그만 기본 펼침 상태로 설정 (UX 개선: 최신 로그는 자동으로 열어서 확인 가능)
  useEffect(() => {
    if (chatLogs.length > 0) {
      // 가장 마지막 로그(최신 로그)의 ID를 찾아서 펼침 상태로 설정
      const lastLog = chatLogs[chatLogs.length - 1];
      setExpandedGroups((prev) => {
        const newSet = new Set(prev);
        // 기존 펼침 상태는 유지하되, 마지막 로그는 항상 포함
        newSet.add(lastLog.id);
        return newSet;
      });
    }
  }, [chatLogs]);

  // 케이스 3: 메시지 목록이 변경되고 채팅 화면에 있을 때 읽음 처리
  // 상대방이 메시지를 보냈거나, 메시지가 업데이트되었을 때 읽음 처리
  // ⚠️ 주의: 너무 자주 실행되지 않도록 디바운싱 적용
  useEffect(() => {
    if (!taskId || !currentUserId || !isPresent || messages.length === 0 || !task) {
      return;
    }

    const isCurrentUserAssigner = currentUserId === task.assigner_id;
    const isCurrentUserAssignee = currentUserId === task.assignee_id;
    const isReference = task.references?.some((ref) => ref.id === currentUserId) ?? false;

    // 지시자/담당자/참조자가 아니면 읽음 처리 안 함
    if (!isCurrentUserAssigner && !isCurrentUserAssignee && !isReference) {
      return;
    }

    // 다른 사람이 보낸 읽지 않은 메시지가 있는지 확인
    const hasUnreadMessages = messages.some((message) => {
      if (message.user_id === currentUserId) return false; // 본인 메시지는 제외
      const readBy = message.read_by || [];
      if (!Array.isArray(readBy)) return true;
      return !readBy.some((id: string) => String(id) === String(currentUserId));
    });

    // 읽지 않은 메시지가 있고, 최근에 읽음 처리를 하지 않았다면 실행
    if (hasUnreadMessages) {
      const now = Date.now();
      // 3초 이내 중복 호출 방지 (디바운싱)
      if (now - lastMarkAsReadTimeRef.current > 3000) {
        lastMarkAsReadTimeRef.current = now;
        markMessagesAsRead.mutate(taskId, {
          onSuccess: () => {},
          onError: (error) => {
            console.error(`[TaskDetail] ❌ Case 3: Failed to mark messages as read:`, error);
            lastMarkAsReadTimeRef.current = 0; // 에러 발생 시 시간 리셋하여 재시도 가능하도록
          },
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, taskId, currentUserId, isPresent, task]); // messages와 task가 변경될 때마다 실행

  // 외부 클릭 및 ESC 키 핸들러 (useCallback으로 메모이제이션)
  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (openMenuMessageId && !(event.target as Element).closest(`[data-message-menu="${openMenuMessageId}"]`)) {
      setOpenMenuMessageId(null);
    }
  }, [openMenuMessageId]);

  const handleEscape = useCallback((event: KeyboardEvent) => {
    if (event.key === "Escape" && openMenuMessageId) {
      setOpenMenuMessageId(null);
    }
  }, [openMenuMessageId]);

  // 외부 클릭 및 ESC 키로 메뉴 닫기 (이벤트 리스너 등록)
  useEffect(() => {
    if (!openMenuMessageId) return;

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [openMenuMessageId, handleClickOutside, handleEscape]);

  // 권한 체크: assigner, assignee, 참조자, Admin만 접근 가능
  useEffect(() => {
    if (!task || !currentUserId) return;

    const isAssigner = currentUserId === task.assigner_id;
    const isAssignee = currentUserId === task.assignee_id;
    const isReference = task.references?.some((ref: { id?: string }) => ref.id === currentUserId) ?? false;

    // 자기 할당 Task는 본인만 접근 가능
    if (task.is_self_task && !isAssigner) {
      toast.error("이 Task에 접근할 권한이 없습니다.");
      navigate(-1);
      return;
    }

    // 일반 Task: assigner, assignee, 참조자, Admin만 접근 가능
    const hasAccess = isAssigner || isAssignee || isReference || isAdmin;
    if (!hasAccess) {
      toast.error("이 업무에 접근할 권한이 없습니다.");
      navigate(-1);
    }
  }, [task, currentUserId, isAdmin, navigate]);

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="container w-full">
        <DefaultSpinner />
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div className="container w-full">
        <Card className="mx-auto max-w-lg">
          <CardContent className="py-8 text-center sm:py-12">
            <p className="text-destructive text-sm font-medium sm:text-base">
              Task를 불러오는 중 오류가 발생했습니다.
            </p>
            <p className="text-muted-foreground mt-2 text-xs break-words sm:text-sm">
              {error.message}
            </p>
            <Button onClick={() => navigate("/")} className="mt-4" size="sm">
              돌아가기
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 데이터 없음
  if (!task) {
    return (
      <div className="w-full">
        <div className="mx-auto">
          <CardContent className="py-8 text-center sm:py-12">
            <p className="text-base font-medium sm:text-lg">Task를 찾을 수 없습니다</p>
            <p className="text-muted-foreground mt-2 text-xs sm:text-sm">
              요청하신 Task가 존재하지 않거나 접근 권한이 없습니다.
            </p>
            <Button onClick={() => navigate("/")} className="mt-4 px-3 py-2" size="sm">
              돌아가기
            </Button>
          </CardContent>
        </div>
      </div>
    );
  }

  // 자기 할당 Task 여부 확인
  const isSelfTask = task.is_self_task === true;

  // 현재 사용자가 assigner인지 assignee인지 참조자인지 확인
  const isAssigner = currentUserId === task.assigner_id;
  const isAssignee = currentUserId === task.assignee_id;
  const isReference = task.references?.some((ref: { id?: string }) => ref.id === currentUserId) ?? false;
  // 수정 권한: 지시자만 수정 가능 (자기 할당 Task는 본인만)
  const canEdit = isAssigner;
  // 삭제 권한: 지시자만 삭제 가능 (자기 할당 Task는 본인만)
  const canDelete = isAssigner;
  // 채팅 작성 권한: 지시자, 담당자, 참조자 (참조자도 채팅 작성 가능)
  const canSendMessage = isAssigner || isAssignee || isReference;

  // 자기 할당 Task: 완료 버튼만 표시 (IN_PROGRESS → APPROVED)
  const canCompleteSelfTask = isSelfTask && isAssigner && task.task_status === "IN_PROGRESS";

  // 일반 Task: 상태 변경 버튼 표시 조건
  const canChangeToInProgress =
    !isSelfTask && isAssignee && (task.task_status === "ASSIGNED" || task.task_status === "REJECTED");
  const canChangeToWaitingConfirm = !isSelfTask && isAssignee && task.task_status === "IN_PROGRESS";
  const canApprove = !isSelfTask && isAssigner && task.task_status === "WAITING_CONFIRM";
  const canReject = !isSelfTask && isAssigner && task.task_status === "WAITING_CONFIRM";
  // 강제 승인 버튼 표시 조건: 지시자만, APPROVED 상태가 아닐 때만 (자기 할당 Task 제외)
  const canForceApprove = !isSelfTask && isAssigner && task.task_status !== "APPROVED";

  // 상대방 정보 계산
  const counterpart = isAssigner ? task.assignee : task.assigner;
  const counterpartName = counterpart?.full_name || counterpart?.email || (isAssigner ? task.assignee_id : task.assigner_id);
  const counterpartEmail = counterpart?.email;

  // 참여자 표시: 참조자 있으면 지시자/담당자/참조자 모두 표시, 없으면 기존처럼 상대방만
  const hasReferences = task.references && task.references.length > 0;
  const participantDisplay = hasReferences
    ? (() => {
        const assignerLabel = task.assigner_id
          ? `지시자: ${task.assigner?.full_name || task.assigner?.email || task.assigner_id}${task.assigner?.email ? `(${task.assigner.email})` : ""}`
          : null;
        const assigneeLabel = task.assignee_id
          ? `담당자: ${task.assignee?.full_name || task.assignee?.email || task.assignee_id}${task.assignee?.email ? `(${task.assignee.email})` : ""}`
          : null;
        const refLabels = (task.references ?? [])
          .map(
            (ref) =>
              `${ref.full_name || ref.email || ref.id}${ref.email ? `(${ref.email})` : ""}`,
          )
          .join(", ");
        const referenceLabel = refLabels ? `참조자: ${refLabels}` : null;
        return [assignerLabel, assigneeLabel, referenceLabel].filter(Boolean).join(", ");
      })()
    : counterpartName + (counterpartEmail && counterpart?.full_name ? ` (${counterpartEmail})` : "");

  // 상태 변경 버튼 클릭 핸들러 (Dialog 표시)
  const handleStatusChangeClick = (newStatus: TaskStatus) => {
    setPendingNewStatus(newStatus);
    setStatusChangeDialogOpen(true);
  };

  // Dialog 확인 후 상태 변경 실행
  const handleStatusChangeConfirm = async () => {
    if (!pendingNewStatus) return;
    await updateTaskStatus.mutateAsync({ taskId: task.id, newStatus: pendingNewStatus });
  };

  // 고객에게 이메일 발송 완료 체크박스 변경 핸들러
  const handleSendEmailToClientChange = async (checked: boolean) => {
    if (!task) return;
    try {
      await updateTask.mutateAsync({
        id: task.id,
        updates: {
          send_email_to_client: checked,
        },
      });
    } catch (error) {
      toast.error("이메일 발송 상태 업데이트에 실패했습니다.");
    }
  };

  // 강제 승인 핸들러 (프론트엔드에서 직접 Supabase 호출)
  const handleForceApprove = async () => {
    if (!task || !currentUserId) return;

    // 지시자 권한 확인 (프론트엔드 레벨)
    if (currentUserId !== task.assigner_id) {
      toast.error("지시자만 강제 승인할 수 있습니다.");
      return;
    }

    // 이미 승인됨 상태면 에러
    if (task.task_status === "APPROVED") {
      toast.error("이미 승인된 업무입니다.");
      return;
    }

    setIsForceApproving(true);

    try {
      // 상태 전환 검증 없이 직접 UPDATE (RLS 정책만 적용됨)
      const { error } = await supabase
        .from("tasks")
        .update({ task_status: "APPROVED" })
        .eq("id", task.id);

      if (error) {
        if (error.code === "42501" || error.message.includes("permission denied")) {
          toast.error("강제 승인 권한이 없습니다.");
        } else {
          toast.error(`강제 승인 실패: ${error.message}`);
        }
        return;
      }

      toast.success("강제 승인되었습니다.");
      
      // React Query 캐시 무효화하여 Task 정보 갱신
      await queryClient.invalidateQueries({ queryKey: ["tasks", "detail", task.id] });
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      // task-list 쿼리도 무효화하여 task-list 상세 페이지에 반영
      await queryClient.invalidateQueries({ queryKey: ["task-lists"] });
    } catch (error) {
      console.error("강제 승인 중 오류:", error);
      toast.error("강제 승인 중 오류가 발생했습니다.");
    } finally {
      setIsForceApproving(false);
      setForceApproveDialogOpen(false);
    }
  };

  // Task 수정 핸들러
  const handleUpdateTask = async (data: TaskCreateFormData | TaskCreateSelfTaskFormData | TaskCreateSpecificationFormData | TaskUpdateFormData) => {
    const updateData = data as TaskUpdateFormData;
    await updateTask.mutateAsync({
      id: task.id,
      updates: {
        title: updateData.title,
        client_name: updateData.client_name,
        due_date: updateData.due_date,
      },
    });
    setEditDialogOpen(false);
  };

  // Task 삭제 핸들러
  const handleDeleteTask = async () => {
    await deleteTask.mutateAsync(task.id);
    navigate("/");
  };

  // 메시지 삭제 핸들러
  const handleDeleteMessageClick = (message: MessageWithProfile) => {
    setPendingDeleteMessage(message);
    setMessageDeleteDialogOpen(true);
    setOpenMenuMessageId(null); // 메뉴 닫기
  };

  // 메뉴용 시간 포맷팅 함수: "(토) 오후 2:38" 형식
  const formatMessageTimeForMenu = (dateString: string) => {
    const date = new Date(dateString);

    // KST 시간대로 변환하여 24시간 형식으로 먼저 가져오기
    const formatter24 = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const formatterWeekday = new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      weekday: "short",
    });

    const parts24 = formatter24.formatToParts(date);
    const hour24 = parseInt(parts24.find((p) => p.type === "hour")?.value || "0", 10);
    const minute = parts24.find((p) => p.type === "minute")?.value || "00";
    const weekday = formatterWeekday.format(date);

    // 오전/오후 판단 및 12시간제 변환
    const ampm = hour24 < 12 ? "오전" : "오후";
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const hour12Str = String(hour12).padStart(2, "0");

    return `(${weekday}) ${ampm} ${hour12Str}:${minute}`;
  };

  // 메시지 복사 핸들러
  const handleCopyMessage = async (message: MessageWithProfile, showFeedback = false) => {
    try {
      let textToCopy = "";

      if (message.message_type === "FILE") {
        // 파일 메시지인 경우 파일명 또는 다운로드 링크 복사
        textToCopy = message.file_name || message.content || "";
        if (message.file_url) {
          textToCopy += `\n${getTaskFileDownloadUrl(message.file_url)}`;
        }
      } else {
        // 텍스트 메시지인 경우 내용 복사
        textToCopy = message.content || "";
      }

      await navigator.clipboard.writeText(textToCopy);
      
      if (showFeedback) {
        // 상대방 메시지 복사 시 피드백 표시
        setCopiedMessageId(message.id);
        setTimeout(() => {
          setCopiedMessageId(null);
        }, 2000); // 2초 후 피드백 제거
      } else {
        // 본인 메시지 복사 시 토스트 표시
        toast.success("메시지가 복사되었습니다.");
        setOpenMenuMessageId(null); // 메뉴 닫기
      }
    } catch (error) {
      console.error("복사 실패:", error);
      toast.error("메시지 복사에 실패했습니다.");
    }
  };

  const handleDeleteMessageConfirm = async () => {
    if (!pendingDeleteMessage) return;
    await deleteMessage.mutateAsync(pendingDeleteMessage.id);
  };

  // 메시지 전송 핸들러 (텍스트 + 파일 통합)
  const handleSendMessage = async () => {
    if (!taskId || createMessageWithFiles.isPending) return;

    const hasText = messageInput.trim().length > 0;
    const hasFiles = attachedFiles.length > 0;

    // 텍스트도 파일도 없으면 전송하지 않음
    if (!hasText && !hasFiles) return;

    const content = hasText ? messageInput.trim() : null;
    const filesToUpload = [...attachedFiles];

    // 입력 초기화 (전송 전에 미리 초기화하여 중복 전송 방지)
    setMessageInput("");
    setAttachedFiles([]);

    try {
      // 파일이 있으면 먼저 업로드
      const uploadedFiles: Array<{
        url: string;
        fileName: string;
        fileType: string;
        fileSize: number;
      }> = [];

      if (filesToUpload.length > 0) {
        setUploadingFiles(new Set(filesToUpload.map((f) => f.name)));

        for (const file of filesToUpload) {
          try {
            const { url, fileName, fileType, fileSize } = await uploadTaskFile(
              file,
              taskId,
              currentUserId!,
            );
            uploadedFiles.push({ url, fileName, fileType, fileSize });
          } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            toast.error(`${file.name} 업로드 실패: ${msg}`);
            // 실패한 파일은 제외하고 계속 진행
          }
        }

        setUploadingFiles(new Set());
      }

      // 텍스트와 파일을 함께 전송
      // 파일이 포함된 경우 bundleId 생성 (로그 생성용)
      const bundleId = uploadedFiles.length > 0 ? crypto.randomUUID() : undefined;

      if (content || uploadedFiles.length > 0) {
        await createMessageWithFiles.mutateAsync({
          taskId,
          content,
          files: uploadedFiles,
          bundleId,
        });

        // 전송 성공 후 입력창에 포커스 복원
        setTimeout(() => {
          textareaRef.current?.focus();
        }, 0);
      }
    } catch (error: unknown) {
      // 에러 발생 시 입력 복원
      setMessageInput(content || "");
      setAttachedFiles(filesToUpload);
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(msg || "메시지 전송에 실패했습니다.");
      // 에러 발생 시에도 포커스 유지 (사용자가 바로 수정할 수 있도록)
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    }
  };

  // 파일 추가 핸들러 (draft 상태로 추가, 즉시 전송하지 않음)
  const handleFileAdd = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles: File[] = [];
    const invalidFiles: string[] = [];

    for (const file of fileArray) {
      // 파일 크기 제한 (10MB)
      if (file.size > 10 * 1024 * 1024) {
        invalidFiles.push(`${file.name} (10MB 초과)`);
        continue;
      }
      validFiles.push(file);
    }

    if (invalidFiles.length > 0) {
      toast.error(`다음 파일은 크기 제한을 초과합니다: ${invalidFiles.join(", ")}`);
    }

    if (validFiles.length > 0) {
      setAttachedFiles((prev) => [...prev, ...validFiles]);
    }
  };

  // 첨부 파일 제거 핸들러
  const handleFileRemove = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // 드래그 앤 드롭 핸들러
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileAdd(e.dataTransfer.files);
    }
  };

  // 파일 선택 핸들러
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileAdd(e.target.files);
    }
    // input 초기화
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // 클립보드에서 이미지 붙여넣기 핸들러
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const clipboardData = e.clipboardData;
    if (!clipboardData) {
      return;
    }

    const items = clipboardData.items;
    if (!items || items.length === 0) {
      return;
    }

    const imageFiles: File[] = [];
    let hasImage = false;

    // 클립보드 항목 순회하여 이미지 찾기
    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // 이미지 타입인지 확인 (kind가 'file'이고 type에 'image'가 포함된 경우)
      if (item.kind === "file" && item.type.startsWith("image/")) {
        hasImage = true;

        try {
          const file = item.getAsFile();
          if (!file) {
            console.warn("[Paste] 파일을 가져올 수 없습니다.");
            continue;
          }

          // 파일명 생성 (타임스탬프 기반)
          const timestamp = Date.now();
          const mimeType = item.type;
          let extension = "png"; // 기본값

          // MIME 타입에서 확장자 추출
          if (mimeType.includes("jpeg") || mimeType.includes("jpg")) {
            extension = "jpg";
          } else if (mimeType.includes("png")) {
            extension = "png";
          } else if (mimeType.includes("gif")) {
            extension = "gif";
          } else if (mimeType.includes("webp")) {
            extension = "webp";
          } else if (mimeType.includes("bmp")) {
            extension = "bmp";
          } else {
            // MIME 타입에서 확장자 추출 시도
            const mimeParts = mimeType.split("/");
            if (mimeParts.length > 1) {
              extension = mimeParts[1].split(";")[0]; // 'image/png;charset=utf-8' 같은 경우 처리
            }
          }

          // File 객체 생성 (파일명 포함)
          // Blob을 기반으로 File 객체 생성
          const blob = new Blob([file], { type: mimeType });
          const fileName = `image-${timestamp}.${extension}`;
          
          // File 생성자 사용 시도 (브라우저 호환성)
          let imageFile: File;
          if (typeof File !== "undefined") {
            // File 생성자 사용
            try {
              // @ts-ignore - File 생성자는 런타임에 존재하지만 타입 정의 문제로 인해 무시
              imageFile = new File([blob], fileName, {
                type: mimeType,
                lastModified: Date.now(),
              });
            } catch (error) {
              console.warn("[Paste] File 생성자 실패, Blob 기반 객체 사용:", error);
              // File 생성자가 실패하면 Blob을 File처럼 사용
              imageFile = Object.assign(blob, {
                name: fileName,
                lastModified: Date.now(),
              }) as File;
            }
          } else {
            // File 생성자가 없는 경우 Blob을 File처럼 사용
            imageFile = Object.assign(blob, {
              name: fileName,
              lastModified: Date.now(),
            }) as File;
          }
          
          imageFiles.push(imageFile);
        } catch (error) {
          console.error("[Paste] 이미지 처리 중 오류:", error);
          toast.error("이미지 붙여넣기에 실패했습니다.");
        }
      }
    }

    // 이미지 파일이 있으면 기본 동작 방지하고 첨부 파일 목록에 추가
    if (hasImage && imageFiles.length > 0) {
      e.preventDefault(); // 기본 텍스트 붙여넣기 방지
      e.stopPropagation();
      handleFileAdd(imageFiles);
      toast.success(`${imageFiles.length}개의 이미지가 첨부되었습니다.`);
    } else if (hasImage) {
      // 이미지가 감지되었지만 파일로 변환 실패
      console.warn("[Paste] 이미지가 감지되었지만 파일로 변환할 수 없습니다.");
      toast.error("이미지를 파일로 변환할 수 없습니다.");
    }
  };

  // 날짜 포맷팅
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "미정";
    return new Date(dateString).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // 메시지 시간 포맷팅 (절대 시간 형식: yy.MM.dd 오전/오후 hh:mm, KST 기준)
  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);

    // KST 시간대로 변환 (Asia/Seoul)
    // Intl.DateTimeFormat을 사용하여 정확한 시간대 변환
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const year = parts.find((p) => p.type === "year")?.value.slice(-2) || "00";
    const month = parts.find((p) => p.type === "month")?.value || "01";
    const day = parts.find((p) => p.type === "day")?.value || "01";
    const hours24 = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
    const minutes = parts.find((p) => p.type === "minute")?.value || "00";

    // 오전/오후 판단
    const ampm = hours24 < 12 ? "오전" : "오후";
    // 12시간제로 변환 (0시는 12시로, 13시 이상은 -12)
    const hours12 = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24;
    const hours12Str = String(hours12).padStart(2, "0");

    return `${year}.${month}.${day} ${ampm}${hours12Str}:${minutes}`;
  };

  // 메시지 시간 문자열 추출 (그룹핑용: yy.MM.dd 오전/오후hh:mm 형식)
  const getMessageTimeKey = (dateString: string): string => {
    const date = new Date(dateString);

    // KST 시간대로 변환
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const year = parts.find((p) => p.type === "year")?.value.slice(-2) || "00";
    const month = parts.find((p) => p.type === "month")?.value || "01";
    const day = parts.find((p) => p.type === "day")?.value || "01";
    const hours24 = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
    const minutes = parts.find((p) => p.type === "minute")?.value || "00";

    // 오전/오후 판단
    const ampm = hours24 < 12 ? "오전" : "오후";
    // 12시간제로 변환
    const hours12 = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24;
    const hours12Str = String(hours12).padStart(2, "0");

    return `${year}.${month}.${day} ${ampm}${hours12Str}:${minutes}`;
  };

  // 두 메시지가 같은 그룹에 속하는지 확인 (같은 sender, 같은 시간, 연속)
  const isSameMessageGroup = (
    msg1: MessageWithProfile,
    msg2: MessageWithProfile | null,
  ): boolean => {
    if (!msg2) return false; // 다음 메시지가 없으면 그룹 아님

    // 같은 sender인지 확인
    if (msg1.user_id !== msg2.user_id) return false;

    // 같은 시간(분 단위)인지 확인
    const timeKey1 = getMessageTimeKey(msg1.created_at);
    const timeKey2 = getMessageTimeKey(msg2.created_at);
    if (timeKey1 !== timeKey2) return false;

    return true;
  };

  // 메시지 리스트에서 각 메시지가 그룹의 마지막인지 계산하는 함수
  const calculateMessageGroupInfo = (messageList: MessageWithProfile[]): Map<string, boolean> => {
    const isLastInGroupMap = new Map<string, boolean>();

    for (let i = 0; i < messageList.length; i++) {
      const currentMsg = messageList[i];
      const nextMsg = i < messageList.length - 1 ? messageList[i + 1] : null;

      // 다음 메시지와 같은 그룹이 아니면 현재 메시지가 그룹의 마지막
      const isLast = !isSameMessageGroup(currentMsg, nextMsg);
      isLastInGroupMap.set(currentMsg.id, isLast);
    }

    return isLastInGroupMap;
  };

  // 메시지의 미읽음 인원 수 (카카오톡 스타일: 참조자 포함 미읽음 인원 표시)
  const getUnreadCount = (message: MessageWithProfile): number => {
    if (!task || !task.assigner_id) return 0;
    try {
      return getUnreadCountForMessageFromData(message, {
        assigner_id: task.assigner_id,
        assignee_id: task.assignee_id,
        references: task.references,
      });
    } catch (error) {
      console.error("읽음 상태 확인 중 에러:", error);
      return 0;
    }
  };

  // 로그에 참조된 메시지 ID 집합 생성 (삭제 버튼 숨김용)
  const loggedMessageIds = new Set<string>();
  chatLogs.forEach((log) => {
    log.items.forEach((item) => {
      loggedMessageIds.add(item.message_id);
    });
  });

  // URL 추출 함수 (링크 미리보기용)
  const extractUrls = (text: string): string[] => {
    if (!text) return [];
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
  };

  // URL을 링크로 변환하는 함수
  const renderTextWithLinks = (text: string) => {
    if (!text) return null;

    // URL 패턴: http:// 또는 https://로 시작하는 URL (공백 전까지)
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = urlRegex.exec(text)) !== null) {
      // URL 이전의 텍스트 추가
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      // URL을 링크로 변환
      const url = match[0];
      parts.push(
        <a
          key={match.index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all underline hover:opacity-80"
          style={{ wordBreak: "break-all", overflowWrap: "break-word" }}
          onClick={(e) => e.stopPropagation()}
        >
          {url}
        </a>,
      );

      lastIndex = urlRegex.lastIndex;
    }

    // 남은 텍스트 추가
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  // 메시지 아이템 렌더링 함수
  const renderMessageItem = (message: MessageWithProfile, isLastInGroup: boolean = true) => {
    const isMine = message.user_id === currentUserId;
    const isLoggedMessage = loggedMessageIds.has(message.id); // 로그에 포함된 메시지인지 확인
    const eventType = getSystemEventType(message);

    // SYSTEM 메시지 처리
    if (message.message_type === "SYSTEM") {
      // 중요한 이벤트 (승인 요청/승인/반려) 강조 UI
      if (eventType === "APPROVAL_REQUEST") {
        return (
          <div
            key={message.id}
            className="my-3 flex max-w-full min-w-0 justify-center px-2 sm:my-4"
            style={{ maxWidth: "100%" }}
          >
            <div
              className="max-w-[90%] min-w-0 rounded-lg border-2 border-blue-200 bg-blue-50 px-4 py-3 shadow-sm sm:max-w-md sm:px-6 sm:py-4 dark:border-blue-800 dark:bg-blue-950"
              style={{ maxWidth: "90%" }}
            >
              <div className="mb-1.5 flex items-center justify-center gap-1.5 sm:mb-2 sm:gap-2">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500 sm:h-2 sm:w-2" />
                <p className="text-xs font-semibold text-blue-900 sm:text-sm dark:text-blue-100">
                  승인 요청
                </p>
              </div>
              <p
                className="text-center text-xs break-words text-blue-800 sm:text-sm dark:text-blue-200"
                style={{ wordBreak: "break-word", overflowWrap: "break-word" }}
              >
                {renderTextWithLinks(message.content || "")}
              </p>
              {isLastInGroup && (
                <p className="mt-1.5 text-center text-[10px] text-blue-600 sm:mt-2 sm:text-xs dark:text-blue-400">
                  {formatMessageTime(message.created_at)}
                </p>
              )}
            </div>
          </div>
        );
      }
      if (eventType === "APPROVED") {
        return (
          <div key={message.id} className="my-3 flex justify-center px-2 sm:my-4">
            <div className="max-w-[90%] rounded-lg border-2 border-green-200 bg-green-50 px-4 py-3 shadow-sm sm:max-w-md sm:px-6 sm:py-4 dark:border-green-800 dark:bg-green-950">
              <div className="mb-1.5 flex items-center justify-center gap-1.5 sm:mb-2 sm:gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 sm:h-5 sm:w-5 dark:text-green-400" />
                <p className="text-xs font-semibold text-green-900 sm:text-sm dark:text-green-100">
                  업무 승인
                </p>
              </div>
              <p
                className="text-center text-xs break-words text-green-800 sm:text-sm dark:text-green-200"
                style={{ wordBreak: "break-word", overflowWrap: "break-word" }}
              >
                {renderTextWithLinks(message.content || "")}
              </p>
              {isLastInGroup && (
                <p className="mt-1.5 text-center text-[10px] text-green-600 sm:mt-2 sm:text-xs dark:text-green-400">
                  {formatMessageTime(message.created_at)}
                </p>
              )}
            </div>
          </div>
        );
      }
      if (eventType === "REJECTED") {
        return (
          <div key={message.id} className="my-3 flex min-w-0 justify-center px-2 sm:my-4">
            <div className="max-w-[90%] min-w-0 rounded-lg border-2 border-red-200 bg-red-50 px-4 py-3 shadow-sm sm:max-w-md sm:px-6 sm:py-4 dark:border-red-800 dark:bg-red-950">
              <div className="mb-1.5 flex items-center justify-center gap-1.5 sm:mb-2 sm:gap-2">
                <XCircle className="h-4 w-4 text-red-600 sm:h-5 sm:w-5 dark:text-red-400" />
                <p className="text-xs font-semibold text-red-900 sm:text-sm dark:text-red-100">
                  업무 반려
                </p>
              </div>
              <p
                className="text-center text-xs break-words text-red-800 sm:text-sm dark:text-red-200"
                style={{ wordBreak: "break-word", overflowWrap: "break-word" }}
              >
                {renderTextWithLinks(message.content || "")}
              </p>
              {isLastInGroup && (
                <p className="mt-1.5 text-center text-[10px] text-red-600 sm:mt-2 sm:text-xs dark:text-red-400">
                  {formatMessageTime(message.created_at)}
                </p>
              )}
            </div>
          </div>
        );
      }
      // 일반 SYSTEM 메시지
      return (
        <div
          key={message.id}
          className="my-2 flex max-w-full min-w-0 justify-center px-2"
          style={{ maxWidth: "100%" }}
        >
          <div
            className="bg-muted/50 border-muted max-w-[90%] min-w-0 rounded-lg border px-3 py-1.5 sm:max-w-md sm:px-4 sm:py-2"
            style={{ maxWidth: "90%" }}
          >
            <p
              className="text-muted-foreground text-center text-xs break-words sm:text-sm"
              style={{ wordBreak: "break-word", overflowWrap: "break-word" }}
            >
              {renderTextWithLinks(message.content || "")}
            </p>
            {isLastInGroup && (
              <p className="text-muted-foreground/70 mt-0.5 text-center text-[10px] sm:mt-1 sm:text-xs">
                {formatMessageTime(message.created_at)}
              </p>
            )}
          </div>
        </div>
      );
    }

    // FILE 메시지 처리
    if (message.message_type === "FILE") {
      return (
        <div
          key={message.id}
          className={cn("mb-3 flex min-w-0 sm:mb-4", isMine ? "justify-end" : "justify-start")}
        >
          <div
            className={cn(
              "flex max-w-[85%] min-w-0 gap-1.5 sm:max-w-md sm:gap-2",
              isMine ? "flex-row-reverse" : "flex-row",
            )}
            style={{ maxWidth: "85%" }}
          >
            {!isMine && (
              <ProfileAvatar
                avatarUrl={message.sender?.avatar_url || null}
                size={28}
                className="shrink-0 sm:h-8 sm:w-8"
                alt={message.sender?.full_name || message.sender?.email || "사용자"}
              />
            )}
            <div className={cn("flex min-w-0 flex-col", isMine ? "items-end" : "items-start")}>
              {!isMine && (
                <span className="text-muted-foreground mb-0.5 max-w-full truncate px-1 text-[10px] sm:mb-1 sm:text-xs">
                  {message.sender?.full_name || message.sender?.email || "사용자"}
                </span>
              )}
              <div className="group relative max-w-full min-w-0" data-message-menu={message.id}>
                <div className="flex items-end gap-1 max-w-full min-w-0">
                  {isMine && (() => {
                    const unread = getUnreadCount(message);
                    return unread > 0 ? (
                      <span className="text-primary shrink-0 pb-0.5 text-[10px] sm:pb-1 sm:text-xs">{unread}</span>
                    ) : null;
                  })()}
                  <div
                    className={cn(
                      "max-w-full min-w-0 rounded-lg border-2 px-3 py-2 sm:px-4 sm:py-3",
                      isMine
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-foreground border-muted",
                    )}
                  >
                  <div className="flex max-w-full min-w-0 items-center gap-2">
                    <span className="shrink-0 text-base sm:text-xl">
                      {getFileIcon(message.file_type || "")}
                    </span>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <a
                        href={getTaskFileDownloadUrl(message.file_url || "")}
                        {...(canOpenInBrowser(message.file_type, message.file_name)
                          ? { target: "_blank", rel: "noopener noreferrer" }
                          : {})}
                        className="block text-xs font-medium break-all hover:underline sm:text-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          // 브라우저에서 열 수 없는 파일만 프로그래밍 방식 다운로드
                          if (!canOpenInBrowser(message.file_type, message.file_name)) {
                            handleFileDownload(
                              e,
                              getTaskFileDownloadUrl(message.file_url || ""),
                              message.file_name,
                            );
                          }
                          // 브라우저에서 열 수 있는 파일은 기본 동작(새 탭 열기) 사용
                        }}
                        title={message.file_name || message.content || undefined}
                        style={{ wordBreak: "break-all", overflowWrap: "break-word" }}
                      >
                        {message.file_name || message.content}
                      </a>
                      <p className="mt-0.5 text-[10px] break-all opacity-70 sm:mt-1 sm:text-xs">
                        {message.file_size ? `${(message.file_size / 1024).toFixed(1)} KB` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {/* 새 탭 열기 버튼: 브라우저에서 열 수 있는 파일에만 표시 */}
                      {canOpenInBrowser(message.file_type, message.file_name) && (
                        <a
                          href={getTaskFileDownloadUrl(message.file_url || "")}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 hover:opacity-70"
                          onClick={(e) => e.stopPropagation()}
                          title="새 탭에서 열기"
                        >
                          <File className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </a>
                      )}
                      {/* 다운로드 버튼: 모든 파일에 대해 표시 */}
                      <a
                        href={getTaskFileDownloadUrl(message.file_url || "")}
                        className="p-1 hover:opacity-70"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFileDownload(
                            e,
                            getTaskFileDownloadUrl(message.file_url || ""),
                            message.file_name,
                          );
                        }}
                        title="다운로드"
                      >
                        <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </a>
                    </div>
                  </div>
                </div>
                </div>
                {/* 상대방 메시지: 복사 아이콘만 표시 */}
                {!isMine && (
                  <div className="absolute -top-1.5 -right-1.5 opacity-0 transition-opacity group-hover:opacity-100 sm:-top-2 sm:-right-2">
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyMessage(message, true);
                        }}
                        className="bg-background/90 backdrop-blur-sm border border-border rounded-full p-1 shadow-sm hover:bg-background transition-colors"
                        aria-label="복사"
                      >
                        {copiedMessageId === message.id ? (
                          <CheckCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-green-600" />
                        ) : (
                          <Copy className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground" />
                        )}
                      </button>
                      {/* Copied! 툴팁 */}
                      {copiedMessageId === message.id && (
                        <div className="absolute top-full right-0 mt-1 px-2 py-1 bg-foreground/90 text-background text-[10px] rounded whitespace-nowrap z-50">
                          Copied!
                          <div className="absolute -top-1 right-2 w-2 h-2 bg-foreground/90 rotate-45"></div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {/* 본인 메시지: 더보기 버튼 */}
                {isMine && (
                  <>
                    <div className="absolute -top-1.5 -right-1.5 opacity-0 transition-opacity group-hover:opacity-100 sm:-top-2 sm:-right-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuMessageId(openMenuMessageId === message.id ? null : message.id);
                        }}
                        className="bg-background/90 backdrop-blur-sm border border-border rounded-full p-1 shadow-sm hover:bg-background transition-colors"
                        aria-label="더보기"
                      >
                        <MoreVertical className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                    {/* 팝오버 메뉴 */}
                    {openMenuMessageId === message.id && (
                      <div className="absolute top-0 left-0 w-48 bg-background border border-border rounded-lg shadow-lg z-50 animate-in fade-in slide-in-from-top-2">
                        {/* 시간 표시 */}
                        <div className="px-4 py-2 border-b border-border">
                          <p className="text-xs text-muted-foreground">
                            {formatMessageTimeForMenu(message.created_at)}
                          </p>
                        </div>
                        {/* 메뉴 항목 */}
                        <div className="py-1">
                          {/* 복사 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyMessage(message);
                            }}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-muted/50 transition-colors flex items-center gap-3"
                          >
                            <Copy className="h-4 w-4 text-muted-foreground" />
                            <span>복사</span>
                          </button>
                          {/* 전송 취소 (로그되지 않은 메시지만) */}
                          {!isLoggedMessage && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteMessageClick(message);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-3"
                            >
                              <RotateCcw className="h-4 w-4 text-destructive" />
                              <span>전송 취소</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
              {isLastInGroup && (
                <div className="mt-0.5 flex items-center gap-1 px-1 sm:mt-1">
                  <span className="text-muted-foreground text-10-regular sm:text-xs">
                    {formatMessageTime(message.created_at)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // USER 메시지: 좌/우 말풍선 구분
    return (
      <div
        key={message.id}
        className={cn(
          "mb-3 flex max-w-full min-w-0 sm:mb-4",
          isMine ? "justify-end" : "justify-start",
        )}
        style={{ maxWidth: "100%" }}
      >
        <div
          className={cn(
            "flex max-w-[85%] min-w-0 gap-1.5 sm:max-w-md sm:gap-2",
            isMine ? "flex-row-reverse" : "flex-row",
          )}
          style={{ maxWidth: "85%" }}
        >
          {!isMine && (
            <ProfileAvatar
              avatarUrl={message.sender?.avatar_url || null}
              size={28}
              className="shrink-0 sm:h-8 sm:w-8"
              alt={message.sender?.full_name || message.sender?.email || "사용자"}
            />
          )}
          <div className={cn("flex min-w-0 flex-col", isMine ? "items-end" : "items-start")}>
            {!isMine && (
              <span className="text-muted-foreground mb-0.5 max-w-full truncate px-1 text-[10px] sm:mb-1 sm:text-xs">
                {message.sender?.full_name || message.sender?.email || "사용자"}
              </span>
            )}
            <div className="group relative max-w-full min-w-0" data-message-menu={message.id}>
              {(() => {
                const urls = extractUrls(message.content || "");
                const hasLinkPreview = !!urls[0];
                const unread = getUnreadCount(message);
                return (
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex items-end gap-1 max-w-full min-w-0">
                      {/* 링크 미리보기 없을 때만: 숫자를 텍스트 박스 옆에 표시 */}
                      {isMine && !hasLinkPreview && unread > 0 && (
                        <span className="text-primary shrink-0 pb-0.5 text-[10px] sm:pb-1 sm:text-xs">{unread}</span>
                      )}
                      <div
                        className={cn(
                          "min-w-0 rounded-lg px-2 py-1 sm:px-3 sm:py-1.5",
                          isMine ? "bg-primary text-primary-foreground w-fit ml-auto" : "bg-muted text-foreground w-fit",
                        )}
                      >
                        <p
                          className="break-words whitespace-pre-wrap text-14-regular md:text-16-regular"
                          style={{ wordBreak: "break-word", overflowWrap: "break-word" }}
                        >
                          {renderTextWithLinks(message.content || "")}
                        </p>
                      </div>
                    </div>
                    {/* 링크 미리보기 (SEO 카드) */}
                    {hasLinkPreview && (
                      <LinkPreviewCard url={urls[0]} isMine={isMine} />
                    )}
                  </div>
                );
              })()}
              {/* 상대방 메시지: 복사 아이콘만 표시 */}
              {!isMine && (
                <div className="absolute -top-1.5 -right-1.5 opacity-0 transition-opacity group-hover:opacity-100 sm:-top-2 sm:-right-2">
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyMessage(message, true);
                      }}
                      className="bg-background/90 backdrop-blur-sm border border-border rounded-full p-1 shadow-sm hover:bg-background transition-colors"
                      aria-label="복사"
                    >
                      {copiedMessageId === message.id ? (
                        <CheckCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-green-600" />
                      ) : (
                        <Copy className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground" />
                      )}
                    </button>
                    {/* Copied! 툴팁 */}
                    {copiedMessageId === message.id && (
                      <div className="absolute top-full right-0 mt-1 px-2 py-1 bg-foreground/90 text-background text-[10px] rounded whitespace-nowrap z-50">
                        Copied!
                        <div className="absolute -top-1 right-2 w-2 h-2 bg-foreground/90 rotate-45"></div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {/* 본인 메시지: 더보기 버튼 */}
              {isMine && (
                <>
                  <div className="absolute -top-1.5 -right-1.5 opacity-0 transition-opacity group-hover:opacity-100 sm:-top-2 sm:-right-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuMessageId(openMenuMessageId === message.id ? null : message.id);
                      }}
                      className="bg-background/90 backdrop-blur-sm border border-border rounded-full p-1 shadow-sm hover:bg-background transition-colors"
                      aria-label="더보기"
                    >
                      <MoreVertical className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                  {/* 팝오버 메뉴 */}
                  {openMenuMessageId === message.id && (
                    <div className="absolute top-0 right-6 w-48 bg-background border border-border rounded-lg shadow-lg z-50 animate-in fade-in slide-in-from-top-2">
                      {/* 시간 표시 */}
                      <div className="px-4 py-2 border-b border-border">
                        <p className="text-xs text-muted-foreground">
                          {formatMessageTimeForMenu(message.created_at)}
                        </p>
                      </div>
                      {/* 메뉴 항목 */}
                      <div className="py-1">
                        {/* 복사 */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyMessage(message);
                          }}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-muted/50 transition-colors flex items-center gap-3"
                        >
                          <Copy className="h-4 w-4 text-muted-foreground" />
                          <span>복사</span>
                        </button>
                        {/* 전송 취소 (로그되지 않은 메시지만) */}
                        {!isLoggedMessage && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteMessageClick(message);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-3"
                          >
                            <RotateCcw className="h-4 w-4 text-destructive" />
                            <span>전송 취소</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            {isLastInGroup && (
              <div className="mt-0.5 flex items-center gap-1 px-1 sm:mt-1">
                {/* 링크 미리보기 있을 때: 숫자 먼저, 그 다음 시간 */}
                {isMine && (() => {
                  const urls = extractUrls(message.content || "");
                  const hasLinkPreview = !!urls[0];
                  const unread = getUnreadCount(message);
                  return hasLinkPreview && unread > 0 ? (
                    <span className="text-primary text-[10px] sm:text-xs">{unread}</span>
                  ) : null;
                })()}
                <span className="text-muted-foreground text-[10px] sm:text-xs">
                  {formatMessageTime(message.created_at)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // SYSTEM 메시지의 이벤트 타입 판단
  const getSystemEventType = (
    message: MessageWithProfile,
  ): "APPROVAL_REQUEST" | "APPROVED" | "REJECTED" | null => {
    if (message.message_type !== "SYSTEM") return null;
    const content = (message.content || "").toLowerCase();
    if (content.includes("승인 요청") || content.includes("waiting_confirm")) {
      return "APPROVAL_REQUEST";
    }
    if (content.includes("승인") || content.includes("approved")) {
      return "APPROVED";
    }
    if (content.includes("반려") || content.includes("rejected")) {
      return "REJECTED";
    }
    return null;
  };

  // 파일 타입 아이콘 반환
  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) return "🖼️";
    if (fileType === "application/pdf") return "📄";
    if (fileType.includes("word") || fileType.includes("document")) return "📝";
    if (fileType.includes("excel") || fileType.includes("spreadsheet")) return "📊";
    return "📎";
  };

  // 브라우저에서 새 탭으로 열 수 있는 파일인지 확인
  // .txt 파일은 제외 (무조건 다운로드만 가능)
  const canOpenInBrowser = (fileType: string | null | undefined, fileName: string | null | undefined): boolean => {
    if (!fileType || !fileName) return false;

    // .txt 파일은 무조건 다운로드만 가능
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (ext === "txt") return false;

    // 이미지 파일
    if (fileType.startsWith("image/")) return true;

    // PDF 파일
    if (fileType === "application/pdf") return true;

    // CSV 파일 (MIME type 또는 확장자 기반)
    if (fileType === "text/csv" || fileType === "application/csv") return true;
    if (ext === "csv") return true;

    return false;
  };

  // 모든 파일에 대해 원본 파일명으로 다운로드하는 핸들러
  // 외부 도메인(Supabase Storage)에서 download 속성이 무시되는 문제를 해결하기 위해
  // 프로그래밍 방식으로 파일을 가져와서 원본 파일명으로 다운로드
  const handleFileDownload = async (
    e: React.MouseEvent<HTMLAnchorElement>,
    fileUrl: string,
    fileName: string | null | undefined,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (!fileUrl || !fileName) return;

    try {
      // 파일을 fetch로 가져오기
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error("파일 다운로드 실패");
      }

      // Blob으로 변환
      const blob = await response.blob();

      // 다운로드 링크 생성 (원본 파일명 사용)
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName; // 원본 파일명으로 다운로드
      document.body.appendChild(link);
      link.click();

      // 정리
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("파일 다운로드 중 오류:", error);
      toast.error("파일 다운로드에 실패했습니다.");
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* 헤더 영역 (고정) */}
      <header className="bg-background  shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 py-2">
          {/* 뒤로가기 버튼 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  navigate("/");
                }}
                className="h-9 w-9 shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>브라우저 뒤로가기 권장</p>
            </TooltipContent>
          </Tooltip>

          {/* 상대방 아바타 */}
          <ProfileAvatar
            avatarUrl={counterpart?.avatar_url || null}
            size={40}
            alt={counterpartName || "사용자"}
          />

          {/* Task 제목 및 참여자 정보 - 채팅 참여자 전체 표시 (truncate 없음) */}
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold truncate">{task.title}</h1>
            <p className="text-xs text-muted-foreground break-words whitespace-normal" title={participantDisplay}>
              {participantDisplay}
            </p>
          </div>

          {/* 상태 변경 버튼들 */}
          <div className="flex items-center gap-1 shrink-0">
            {/* 자기 할당 Task: 완료 버튼만 표시 */}
            {canCompleteSelfTask && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleStatusChangeClick("APPROVED")}
                disabled={updateTaskStatus.isPending}
                className="h-8 px-2 text-xs"
                title="완료"
              >
                <CheckCircle className="h-4 w-4" />
              </Button>
            )}
            {/* 일반 Task: 기존 상태 변경 버튼들 */}
            {canChangeToInProgress && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleStatusChangeClick("IN_PROGRESS")}
                disabled={updateTaskStatus.isPending}
                className="h-8 px-2 text-xs"
                title={task.task_status === "REJECTED" ? "다시 진행" : "시작하기"}
              >
                <Play className="h-4 w-4" />
              </Button>
            )}
            {canChangeToWaitingConfirm && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleStatusChangeClick("WAITING_CONFIRM")}
                disabled={updateTaskStatus.isPending}
                className="h-8 px-2 text-xs"
                title="완료 요청"
              >
                <CheckCircle className="h-4 w-4" />
              </Button>
            )}
            {canApprove && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleStatusChangeClick("APPROVED")}
                disabled={updateTaskStatus.isPending}
                className="h-8 px-2 text-xs"
                title="승인"
              >
                <CheckCircle className="h-4 w-4" />
              </Button>
            )}
            {canReject && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleStatusChangeClick("REJECTED")}
                disabled={updateTaskStatus.isPending}
                className="h-8 px-2 text-xs text-destructive hover:text-destructive"
                title="거부"
              >
                <XCircle className="h-4 w-4" />
              </Button>
            )}
            {canForceApprove && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setForceApproveDialogOpen(true)}
                disabled={isForceApproving || updateTaskStatus.isPending}
                className="h-8 px-2 text-xs text-destructive hover:text-destructive"
                title="강제 승인 (모든 검증 건너뛰기)"
              >
                <AlertTriangle className="h-4 w-4" />
              </Button>
            )}
            {/* 목록에 추가 버튼 */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setAddToListDialogOpen(true)}
              className="h-9 w-9 shrink-0"
              title="목록에 추가"
            >
                  <HeartPlus className="h-5 w-5"/>
            </Button>
            {/* 컨펌 이메일 전송 버튼: 검토+승인+담당자 */}
            {task.task_category === "REVIEW" &&
              task.task_status === "APPROVED" &&
              isAssignee && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setConfirmEmailDialogOpen(true)}
                className="h-9 w-9 shrink-0"
                title="컨펌 이메일 전송"
              >
                <Mail className="h-5 w-5" />
              </Button>
            )}
            {/* 공유 버튼 */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShareDialogOpen(true)}
              className="h-9 w-9 shrink-0"
              title="공유"
            >
              <Share2 className="h-5 w-5" />
            </Button>
            {/* 정보 버튼 */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDetailSheetOpen(true)}
              className="h-9 w-9 shrink-0"
              title="상세 정보"
            >
              <Info className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* 채팅 영역 (스크롤 가능) */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            ref={chatScrollContainerRef}
            className="relative flex-1 overflow-x-hidden overflow-y-auto pt-4"
            onScroll={handleChatScroll}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
              {messagesLoading || logsLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Spinner />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-muted-foreground text-sm">아직 메시지가 없습니다.</p>
                </div>
              ) : (
                <div
                  className="max-w-full min-w-0 space-y-1 px-2 sm:px-4"
                  style={{ maxWidth: "100%" }}
                >
                  {/* 일반 메시지 (로그에 참조되지 않은 메시지, SYSTEM 제외) */}
                  {(() => {
                    const regularMessages = messages.filter(
                      (msg) => !loggedMessageIds.has(msg.id) && msg.message_type !== "SYSTEM",
                    );

                    // SYSTEM 메시지 (상태 변경 알림)
                    const systemMessages = messages.filter((msg) => msg.message_type === "SYSTEM");

                    // 타임라인 구성: 로그와 SYSTEM 메시지를 시간순으로 배치
                    const timeline: Array<
                      | { type: "log"; data: ChatLogWithItems; timestamp: number }
                      | { type: "system"; data: MessageWithProfile; timestamp: number }
                    > = [];

                    // 로그 추가 (로그 박스)
                    chatLogs.forEach((log) => {
                      timeline.push({
                        type: "log" as const,
                        data: log,
                        timestamp: new Date(log.created_at).getTime(),
                      });
                    });

                    // SYSTEM 메시지 추가 (상태 변경 알림)
                    systemMessages.forEach((msg) => {
                      timeline.push({
                        type: "system" as const,
                        data: msg,
                        timestamp: new Date(msg.created_at).getTime(),
                      });
                    });

                    // 타임라인 정렬 (로그와 SYSTEM 메시지)
                    timeline.sort((a, b) => {
                      if (a.timestamp === b.timestamp) {
                        // 같은 시간이면 로그가 먼저 (로그 박스가 SYSTEM 메시지보다 먼저 표시)
                        return a.type === "log" ? -1 : 1;
                      }
                      return a.timestamp - b.timestamp;
                    });

                    // SYSTEM 메시지와 일반 메시지를 합쳐서 그룹 정보 계산
                    const allMessagesForGrouping: MessageWithProfile[] = [];
                    timeline.forEach((item) => {
                      if (item.type === "system") {
                        allMessagesForGrouping.push(item.data);
                      }
                    });
                    allMessagesForGrouping.push(...regularMessages);

                    // 그룹 정보 계산
                    const groupInfoMap = calculateMessageGroupInfo(allMessagesForGrouping);

                    // 렌더링: 타임라인 + 일반 메시지
                    return (
                      <>
                        {/* 타임라인 (로그 박스 + SYSTEM 메시지) */}
                        {timeline.map((item) => {
                          if (item.type === "log") {
                            const log = item.data;
                            // 로그 내부 메시지들의 그룹 정보 계산
                            const logMessages = log.items.map(
                              (logItem: { message: MessageWithProfile }) => logItem.message,
                            );
                            const logGroupInfoMap = calculateMessageGroupInfo(logMessages);

                            // 로그 내부 메시지 렌더링 함수 (그룹 정보 포함)
                            const renderLogMessage = (message: MessageWithProfile) => {
                              const isLastInGroup = logGroupInfoMap.get(message.id) ?? true;
                              return renderMessageItem(message, isLastInGroup);
                            };

                            return (
                              <div key={log.id}>
                                <ChatLogGroup
                                  log={log}
                                  isExpanded={expandedGroups.has(log.id)}
                                  onToggle={() => {
                                    const newSet = new Set(expandedGroups);
                                    if (newSet.has(log.id)) newSet.delete(log.id);
                                    else newSet.add(log.id);
                                    setExpandedGroups(newSet);
                                  }}
                                  renderMessage={renderLogMessage}
                                />
                              </div>
                            );
                          } else {
                            // SYSTEM 메시지
                            const isLastInGroup = groupInfoMap.get(item.data.id) ?? true;
                            return (
                              <div key={item.data.id}>
                                {renderMessageItem(item.data, isLastInGroup)}
                              </div>
                            );
                          }
                        })}

                        {/* 일반 메시지 (로그에 참조되지 않은 메시지) */}
                        {regularMessages.map((msg) => {
                          const isLastInGroup = groupInfoMap.get(msg.id) ?? true;
                          return <div key={msg.id}>{renderMessageItem(msg, isLastInGroup)}</div>;
                        })}
                      </>
                    );
                  })()}
                </div>
              )}
              {/* 스크롤 앵커 */}
              <div ref={messagesEndRef} />
          </div>

          {/* 입력 영역 */}
          <div className="bg-background shrink-0 space-y-2 border-t py-4">
            {/* 채팅 작성 권한이 없는 경우 안내 메시지 */}
            {!canSendMessage && (
              <div className="bg-muted/50 border-muted rounded-lg border p-3 text-center sm:p-4">
                <p className="text-muted-foreground text-xs sm:text-sm">
                  지시자, 담당자, 참조자만 메시지를 작성할 수 있습니다.
                </p>
                {isAdmin && (
                  <p className="text-muted-foreground/70 mt-1 text-xs">
                    관리자 권한으로 조회만 가능합니다.
                  </p>
                )}
              </div>
            )}

            {/* 첨부된 파일 목록 (Draft 상태) - 지시자/담당자만 표시 */}
            {canSendMessage && attachedFiles.length > 0 && (
                <div className="bg-muted/30 flex flex-wrap gap-1.5 rounded-lg p-2.5 sm:gap-2 sm:p-3">
                  {attachedFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="bg-background hover:bg-muted/50 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-sm transition-colors sm:gap-2 sm:px-3 sm:py-2 sm:text-sm"
                    >
                      <File className="text-primary h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                      <span className="max-w-[120px] truncate font-medium sm:max-w-[200px]">
                        {file.name}
                      </span>
                      <span className="text-muted-foreground hidden text-xs sm:inline">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                      <button
                        type="button"
                        onClick={() => handleFileRemove(index)}
                        className="hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded p-0.5 transition-colors sm:p-1"
                        aria-label="파일 제거"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

            {/* 텍스트 입력 및 전송 - 지시자/담당자만 표시 */}
            {canSendMessage && (
              <div
                className={cn(
                  "bg-muted/50 relative flex flex-col gap-2 rounded-lg border p-2 transition-colors sm:p-3",
                  dragActive && "bg-primary/10 border-primary/50",
                )}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                {/* 드래그 앤 드롭 활성 상태 표시 */}
                {dragActive && (
                  <div className="border-primary bg-primary/10 pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed">
                    <div className="text-primary flex flex-col items-center gap-2">
                      <Plus className="h-8 w-8 animate-bounce" />
                      <p className="text-sm font-medium">파일을 여기에 놓으세요</p>
                    </div>
                  </div>
                )}

                {/* 입력 필드 */}
                <textarea
                  ref={textareaRef}
                  rows={2}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onPaste={handlePaste}
                  placeholder="메시지 입력..."
                  className="w-full border-0 bg-transparent px-2 py-1.5 text-sm focus:outline-none sm:px-3 sm:py-2 sm:text-base"
                  style={{
                    lineHeight: "1.5",
                  }}
                  onKeyDown={(e) => {
                    // Enter 키: 메시지 전송
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                    // Shift+Enter: 줄바꿈 (기본 동작 유지)
                  }}
                  disabled={createMessageWithFiles.isPending}
                />

                {/* 하단 버튼 영역 */}
                <div className="flex items-center justify-between gap-2">
                  {/* 파일 첨부 버튼 */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="border-border hover:bg-background h-8 w-8 shrink-0 rounded-full border sm:h-9 sm:w-9"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={createMessageWithFiles.isPending}
                    title="파일 첨부"
                  >
                    <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                    accept="*/*"
                    disabled={!canSendMessage}
                  />

                  {/* 전송 버튼 */}
                  <Button
                    size="icon"
                    className="bg-background hover:bg-background/80 border-border h-8 w-8 shrink-0 rounded-full border sm:h-9 sm:w-9"
                    disabled={
                      (!messageInput.trim() && attachedFiles.length === 0) ||
                      createMessageWithFiles.isPending
                    }
                    onClick={handleSendMessage}
                    title="전송"
                  >
                    {createMessageWithFiles.isPending ? (
                      <div className="border-foreground h-3.5 w-3.5 animate-spin rounded-full border-2 border-t-transparent sm:h-4 sm:w-4" />
                    ) : (
                      <Send className="text-foreground h-3.5 w-3.5 rotate-[-45deg] sm:h-4 sm:w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 수정 다이얼로그 */}
      <TaskFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSubmit={handleUpdateTask}
        task={task}
        isLoading={updateTask.isPending}
      />

      {/* 삭제 확인 다이얼로그 */}
      <TaskDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteTask}
        taskId={task.id}
        isLoading={deleteTask.isPending}
      />

      {/* 상태 변경 확인 다이얼로그 */}
      {pendingNewStatus && (
        <TaskStatusChangeDialog
          open={statusChangeDialogOpen}
          onOpenChange={setStatusChangeDialogOpen}
          currentStatus={task.task_status}
          newStatus={pendingNewStatus}
          taskTitle={task.title}
          onConfirm={handleStatusChangeConfirm}
          isLoading={updateTaskStatus.isPending}
        />
      )}

      {/* 강제 승인 확인 다이얼로그 */}
      {task && (
        <TaskForceApproveDialog
          open={forceApproveDialogOpen}
          onOpenChange={setForceApproveDialogOpen}
          currentStatus={task.task_status}
          taskTitle={task.title}
          onConfirm={handleForceApprove}
          isLoading={isForceApproving}
        />
      )}

      {/* 메시지 삭제 확인 다이얼로그 */}
      <MessageDeleteDialog
        open={messageDeleteDialogOpen}
        onOpenChange={setMessageDeleteDialogOpen}
        message={pendingDeleteMessage}
        onConfirm={handleDeleteMessageConfirm}
        isLoading={deleteMessage.isPending}
      />

      {/* 상세 정보 Dialog */}
      <TaskDetailDialog
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        task={task}
        canEdit={canEdit}
        canDelete={canDelete}
        currentUserId={currentUserId}
        onEdit={() => setEditDialogOpen(true)}
        onDelete={() => setDeleteDialogOpen(true)}
        onSendEmailToClientChange={handleSendEmailToClientChange}
      />

      {/* 목록에 추가 Dialog */}
      {taskId && (
        <AddToListDialog
          open={addToListDialogOpen}
          onOpenChange={setAddToListDialogOpen}
          taskId={taskId}
        />
      )}

      {/* 공유 Dialog */}
      {task && (
        <TaskShareDialog
          task={task}
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
        />
      )}

      {/* 컨펌 이메일 전송 Dialog */}
      {task && taskId && (
        <ConfirmEmailDialog
          open={confirmEmailDialogOpen}
          onOpenChange={setConfirmEmailDialogOpen}
          taskId={taskId}
          taskTitle={task.title}
        />
      )}
    </div>
  );
}
