import { useMemo, useState, useRef, useEffect } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import koLocale from "@fullcalendar/core/locales/ko";
import type { EventDropArg, EventClickArg, DatesSetArg, EventContentArg } from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import { useNavigate, useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTaskSchedules, useUpdateTaskSchedule } from "@/hooks/queries/use-schedules";
import { convertToFullCalendarEvents, getStatusIcon } from "@/utils/schedule";
import DefaultSpinner from "../common/default-spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { createRoot } from "react-dom/client";
import type { TaskScheduleWithTask, TaskCategory } from "@/types/domain/schedule";
import { cn } from "@/lib/utils";
// FullCalendar v6 automatically injects CSS, no manual import needed

interface TaskCalendarProps {
  initialView?: "dayGridMonth" | "timeGridWeek" | "timeGridDay";
  selectedUserId?: string; // 선택된 사용자 ID (관리자가 다른 사용자 일정 조회 시)
  readOnly?: boolean; // 읽기 전용 모드 (드래그/리사이즈 불가)
}

export function TaskCalendar({ initialView = "timeGridWeek", selectedUserId, readOnly = false }: TaskCalendarProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [startDate, setStartDate] = useState<Date>(() => {
    // Initialize with current month start
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [endDate, setEndDate] = useState<Date>(() => {
    // Initialize with current month end
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  });
  const prevSelectedUserIdRef = useRef<string | undefined>(selectedUserId);
  const prevStartDateRef = useRef<Date>(startDate);
  const prevEndDateRef = useRef<Date>(endDate);
  const prevViewTypeRef = useRef<string | null>(searchParams.get("view") || "week");

  // Fetch schedules for the current date range
  // placeholderData로 인해 이전 데이터가 표시되면서 새 데이터 로드
  // excludeApproved: false로 설정하여 APPROVED 상태 일정도 표시
  const { data: schedules = [], isLoading, error } = useTaskSchedules(startDate, endDate, false, selectedUserId);
  const updateScheduleMutation = useUpdateTaskSchedule(startDate, endDate, selectedUserId);

  // selectedUserId가 변경될 때 이전 쿼리 캐시 무효화
  useEffect(() => {
    if (prevSelectedUserIdRef.current !== selectedUserId) {
      // 이전 userId의 모든 쿼리 캐시 무효화 (날짜 범위와 관계없이)
      if (prevSelectedUserIdRef.current !== undefined) {
        queryClient.invalidateQueries({ 
          predicate: (query) => {
            const key = query.queryKey;
            // 쿼리 키가 ["task-schedules", startDateStr, endDateStr, excludeApproved, userId] 형식
            return (
              key[0] === "task-schedules" &&
              key.length >= 5 &&
              typeof key[1] === "string" && // ISO 문자열
              typeof key[2] === "string" && // ISO 문자열
              key[4] === prevSelectedUserIdRef.current
            );
          }
        });
      }
      // 새로운 userId의 모든 쿼리도 무효화하여 새로 로드되도록 함
      // undefined인 경우도 포함 (내 일정으로 돌아올 때)
      if (selectedUserId !== undefined) {
        queryClient.invalidateQueries({ 
          predicate: (query) => {
            const key = query.queryKey;
            return (
              key[0] === "task-schedules" &&
              key.length >= 5 &&
              typeof key[1] === "string" &&
              typeof key[2] === "string" &&
              key[4] === selectedUserId
            );
          }
        });
      }
      // selectedUserId가 undefined일 때는 모든 userId에 대한 쿼리도 무효화
      if (selectedUserId === undefined) {
        queryClient.invalidateQueries({ 
          predicate: (query) => {
            const key = query.queryKey;
            // userId가 없는 쿼리: ["task-schedules", startDateStr, endDateStr, excludeApproved]
            return (
              key[0] === "task-schedules" &&
              key.length === 4 &&
              typeof key[1] === "string" &&
              typeof key[2] === "string"
            );
          }
        });
      }
      prevSelectedUserIdRef.current = selectedUserId;
    }
  }, [selectedUserId, queryClient]);
  const scheduleMapRef = useRef<Map<string, TaskScheduleWithTask>>(new Map());
  const calendarContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const isUpdatingRef = useRef<boolean>(false);
  const scrollRestoreAttemptsRef = useRef<number>(0);

  // Convert schedules to FullCalendar events
  const events = useMemo(() => {
    // Schedule map을 업데이트 (tooltip에서 사용)
    scheduleMapRef.current.clear();
    schedules.forEach((schedule) => {
      scheduleMapRef.current.set(schedule.id, schedule);
    });
    return convertToFullCalendarEvents(schedules);
  }, [schedules]);

  // Handle date range changes from FullCalendar
  // Also updates URL search params when view changes
  const handleDatesSet = (arg: DatesSetArg) => {
    // FullCalendar provides start and end dates for the current view
    const newStartDate = arg.start;
    const newEndDate = arg.end;
    
    // 날짜 범위가 변경되었는지 확인 (prev/next 버튼 클릭 감지)
    const dateChanged = 
      prevStartDateRef.current.getTime() !== newStartDate.getTime() ||
      prevEndDateRef.current.getTime() !== newEndDate.getTime();
    
    // 날짜 범위 업데이트 (placeholderData로 인해 이전 데이터가 표시되면서 새 데이터 로드)
    setStartDate(newStartDate);
    setEndDate(newEndDate);
    
    // Update URL search params based on current view
    const viewType = arg.view.type;
    let viewParam: string;
    
    if (viewType === "timeGridWeek") {
      viewParam = "week";
    } else if (viewType === "timeGridDay") {
      viewParam = "day";
    } else {
      viewParam = "month"; // dayGridMonth
    }

    // URL 파라미터 업데이트 (replace: true로 브라우저 히스토리 쌓지 않음)
    const newParams = new URLSearchParams(searchParams);
    const currentViewParam = newParams.get("view") || "week";
    
    // 뷰 타입이 변경되었는지 확인
    const viewChanged = prevViewTypeRef.current !== viewParam;
    
    const startDateStr = newStartDate.toISOString();
    const endDateStr = newEndDate.toISOString();
    
    // 날짜가 변경되었거나 뷰 타입이 변경되었을 때 쿼리 무효화 및 재패치
    if (dateChanged || viewChanged) {
      // 이전 날짜 범위의 쿼리 무효화 (placeholderData를 위해)
      const prevStartDateStr = prevStartDateRef.current.toISOString();
      const prevEndDateStr = prevEndDateRef.current.toISOString();
      
      // 이전 날짜 범위의 쿼리 무효화
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          if (selectedUserId !== undefined) {
            return (
              key[0] === "task-schedules" &&
              key.length >= 5 &&
              typeof key[1] === "string" &&
              typeof key[2] === "string" &&
              key[1] === prevStartDateStr &&
              key[2] === prevEndDateStr &&
              key[4] === selectedUserId
            );
          } else {
            return (
              key[0] === "task-schedules" &&
              key.length === 4 &&
              typeof key[1] === "string" &&
              typeof key[2] === "string" &&
              key[1] === prevStartDateStr &&
              key[2] === prevEndDateStr
            );
          }
        }
      });
      
      // 새 날짜 범위의 쿼리 무효화하여 강제로 새 데이터 가져오기
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          if (selectedUserId !== undefined) {
            return (
              key[0] === "task-schedules" &&
              key.length >= 5 &&
              typeof key[1] === "string" &&
              typeof key[2] === "string" &&
              key[1] === startDateStr &&
              key[2] === endDateStr &&
              key[4] === selectedUserId
            );
          } else {
            return (
              key[0] === "task-schedules" &&
              key.length === 4 &&
              typeof key[1] === "string" &&
              typeof key[2] === "string" &&
              key[1] === startDateStr &&
              key[2] === endDateStr
            );
          }
        }
      });
      
      // 이전 날짜 범위 추적 업데이트
      prevStartDateRef.current = newStartDate;
      prevEndDateRef.current = newEndDate;
      
      if (viewChanged) {
        prevViewTypeRef.current = viewParam;
      }
    }
    
    // 현재 URL 파라미터와 다를 때만 업데이트 (무한 루프 방지)
    if (currentViewParam !== viewParam) {
      if (viewParam === "week") {
        // 기본값이므로 파라미터에서 제거
        newParams.delete("view");
      } else {
        newParams.set("view", viewParam);
      }
      setSearchParams(newParams, { replace: true });
    }
  };

  // Format date for display
  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return "미정";
    const date = new Date(dateString);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Format time for display (HH:mm format)
  const formatTime = (date: Date | string | null | undefined): string => {
    if (!date) return "";
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  // Get category label in Korean
  const getCategoryLabel = (category: TaskCategory): string => {
    const categoryLabels: Record<TaskCategory, string> = {
      REVIEW: "검토",
      REVISION: "수정",
      CONTRACT: "계약",
      SPECIFICATION: "명세서",
      APPLICATION: "출원",
    };
    return categoryLabels[category] || category;
  };

  // Handle event click - navigate to task detail page
  const handleEventClick = (info: EventClickArg) => {
    const taskId = info.event.extendedProps?.taskId;
    if (taskId) {
      navigate(`/tasks/${taskId}`);
    }
  };

  // Handle event content rendering - display instructions and schedule time with tooltip
  const handleEventContent = (arg: EventContentArg) => {
    const schedule = scheduleMapRef.current.get(arg.event.id);
    if (!schedule) {
      // Fallback to default title if schedule not found
      return { html: arg.event.title };
    }

    const task = schedule.task;
    const startTime = schedule.start_time instanceof Date ? schedule.start_time : new Date(schedule.start_time);
    const endTime = schedule.end_time instanceof Date ? schedule.end_time : new Date(schedule.end_time);
    
    // 지시사항 (task title) + 고객명
    const clientName = task.client_name || "고객명 없음";
    const instructions = `${task.title}(${clientName})`;
    
    // 카테고리 한글명 (툴팁용)
    const categoryLabel = getCategoryLabel(task.task_category);
    
    // 일정 관리 시간 (HH:mm - HH:mm 형식)
    const timeRange = schedule.is_all_day 
      ? "종일" 
      : `${formatTime(startTime)} - ${formatTime(endTime)}`;

    // 상태 아이콘 정보 가져오기
    const statusIconConfig = getStatusIcon(task.task_status);
    const StatusIcon = statusIconConfig.icon;

    // Tooltip 내용 생성
    const tooltipContent = [
      `고유 ID: ${task.id.slice(0, 8).toUpperCase()}`,
      task.client_name && `고객명: ${task.client_name}`,
      `지시사항: ${task.title}`,
      `카테고리: ${categoryLabel}`,
      `생성일: ${formatDate(task.created_at)}`,
      task.due_date && `마감일: ${formatDate(task.due_date)}`,
    ]
      .filter(Boolean)
      .join("\n");

    // DOM 요소 생성 (tooltip을 포함한 wrapper)
    const wrapper = document.createElement("div");
    wrapper.style.width = "100%";
    wrapper.style.height = "100%";
    wrapper.style.cursor = "pointer";
    
    // React 컴포넌트로 tooltip과 내용 렌더링
    const root = createRoot(wrapper);
    
    root.render(
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            style={{ 
              width: "100%", 
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: "2px 4px",
              fontSize: "12px",
              lineHeight: "1.3"
            }}
          >
            {/* 지시사항과 상태 아이콘 */}
            <div 
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                fontWeight: "500",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              }}
            >
              <StatusIcon 
                className={cn(
                  "size-3 flex-shrink-0",
                  statusIconConfig.color,
                  statusIconConfig.hasOpacity && "opacity-50"
                )} 
              />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {instructions}
              </span>
            </div>
            {/* 시간 */}
            <div 
              style={{
                fontSize: "11px",
                opacity: "0.8"
              }}
            >
              {timeRange}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs whitespace-pre-line text-left">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    );

    return { domNodes: [wrapper] };
  };


  // 스크롤 위치 저장 헬퍼 함수
  const saveScrollPosition = () => {
    if (calendarContainerRef.current) {
      // 월 뷰의 경우 window 스크롤 확인
      const windowScroll = window.scrollY || window.pageYOffset;
      if (windowScroll > 0) {
        scrollPositionRef.current = windowScroll;
        return;
      }
      
      // FullCalendar 내부 스크롤 컨테이너 확인
      const scrollContainer = calendarContainerRef.current.querySelector('.fc-scroller') as HTMLElement;
      if (scrollContainer && scrollContainer.scrollTop > 0) {
        scrollPositionRef.current = scrollContainer.scrollTop;
        return;
      }
      
      // 부모 컨테이너의 스크롤 확인
      const parentScrollable = calendarContainerRef.current.closest('[style*="overflow"], .overflow-auto, .overflow-y-auto') as HTMLElement;
      if (parentScrollable && parentScrollable.scrollTop > 0) {
        scrollPositionRef.current = parentScrollable.scrollTop;
      }
    }
  };

  // Handle event drop - update schedule (날짜/시간 변경)
  const handleEventDrop = async (info: EventDropArg) => {
    try {
      // 스크롤 위치 저장 (mutation 시작 전)
      saveScrollPosition();
      isUpdatingRef.current = true;
      scrollRestoreAttemptsRef.current = 0;

      // 시간 기반 뷰(timeGridWeek, timeGridDay)에서 드래그하면 종일 일정이 아닌 것으로 변경
      const viewType = info.view.type;
      const isTimeBasedView = viewType === "timeGridWeek" || viewType === "timeGridDay";
      const shouldBeAllDay = info.event.allDay && !isTimeBasedView;

      // 종일 일정의 경우 end가 없을 수 있으므로 start_time을 기준으로 계산
      let endTime = info.event.end;
      if (!endTime && info.event.start) {
        // 종일 일정인 경우 하루 종료 시간으로 설정
        if (shouldBeAllDay) {
          endTime = new Date(info.event.start);
          endTime.setHours(23, 59, 59, 999);
        } else {
          // 시간 기반 일정인 경우 기본 1시간
          endTime = new Date(info.event.start.getTime() + 60 * 60 * 1000);
        }
      }

      await updateScheduleMutation.mutateAsync({
        id: info.event.id,
        updates: {
          start_time: info.event.start!,
          end_time: endTime || info.event.start!,
          is_all_day: shouldBeAllDay,
        },
      });

      // finally에서 isUpdatingRef를 false로 설정하지 않음 - useEffect에서 스크롤 복원 후 설정
    } catch (error) {
      // Revert the event on error
      console.error("일정 이동 실패:", error);
      if (error instanceof Error) {
        console.error("에러 메시지:", error.message);
        console.error("에러 스택:", error.stack);
      }
      info.revert();
      isUpdatingRef.current = false; // 에러 시에만 false로 설정
    }
  };

  // Handle event resize - update schedule (기간/시간 조정)
  const handleEventResize = async (info: EventResizeDoneArg) => {
    try {
      // 스크롤 위치 저장 (mutation 시작 전)
      saveScrollPosition();
      isUpdatingRef.current = true;
      scrollRestoreAttemptsRef.current = 0;

      // 리사이즈는 시간 기반 뷰에서만 가능하므로 종일 일정이 아님
      const endTime = info.event.end || new Date(info.event.start!.getTime() + 60 * 60 * 1000);

      await updateScheduleMutation.mutateAsync({
        id: info.event.id,
        updates: {
          start_time: info.event.start!,
          end_time: endTime,
          is_all_day: false, // 리사이즈는 시간 기반 뷰에서만 가능하므로 항상 false
        },
      });

      // finally에서 isUpdatingRef를 false로 설정하지 않음 - useEffect에서 스크롤 복원 후 설정
    } catch (error) {
      // Revert the event on error
      console.error("일정 기간 조정 실패:", error);
      if (error instanceof Error) {
        console.error("에러 메시지:", error.message);
        console.error("에러 스택:", error.stack);
      }
      info.revert();
      isUpdatingRef.current = false; // 에러 시에만 false로 설정
    }
  };

  // 스크롤 위치 복원 (데이터 업데이트 후)
  useEffect(() => {
    if (isUpdatingRef.current && scrollPositionRef.current > 0 && calendarContainerRef.current) {
      // 여러 프레임에 걸쳐 스크롤 복원 시도 (DOM 렌더링 완료 대기)
      const restoreScroll = () => {
        scrollRestoreAttemptsRef.current += 1;
        
        // 월 뷰의 경우 window 스크롤 복원
        if (window.scrollY === 0 && scrollPositionRef.current > 0) {
          window.scrollTo(0, scrollPositionRef.current);
        }
        
        // FullCalendar 내부 스크롤 컨테이너 복원
        const scrollContainer = calendarContainerRef.current?.querySelector('.fc-scroller') as HTMLElement;
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollPositionRef.current;
        }
        
        // 부모 컨테이너의 스크롤 복원
        const parentScrollable = calendarContainerRef.current?.closest('[style*="overflow"], .overflow-auto, .overflow-y-auto') as HTMLElement;
        if (parentScrollable) {
          parentScrollable.scrollTop = scrollPositionRef.current;
        }
        
        // 최대 5번까지 재시도 (DOM 렌더링 완료 대기)
        if (scrollRestoreAttemptsRef.current < 5) {
          requestAnimationFrame(restoreScroll);
        } else {
          // 복원 완료 후 플래그 리셋
          isUpdatingRef.current = false;
          scrollRestoreAttemptsRef.current = 0;
        }
      };
      
      // 첫 번째 시도는 약간의 지연 후 실행
      setTimeout(() => {
        requestAnimationFrame(restoreScroll);
      }, 50);
    }
  }, [schedules]);

  if (isLoading) {
    return (
      <DefaultSpinner />
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-destructive">
          일정을 불러오는 중 오류가 발생했습니다: {error instanceof Error ? error.message : "알 수 없는 오류"}
        </div>
      </div>
    );
  }

  return (
    <div ref={calendarContainerRef} className="w-full h-full">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={initialView}
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay",
        }}
        events={events}
        editable={!readOnly}
        droppable={false}
        eventStartEditable={!readOnly}
        eventDurationEditable={!readOnly}
        eventClick={handleEventClick}
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
        datesSet={handleDatesSet}
        eventContent={handleEventContent}
        height="auto"
        locale={koLocale}
        buttonText={{
          today: "오늘",
          month: "월",
          week: "주",
          day: "일",
        }}
        dayHeaderFormat={{ weekday: "short" }}
      />
    </div>
  );
}
