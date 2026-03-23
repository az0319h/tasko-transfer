import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTaskSchedules, updateTaskSchedule } from "@/api/schedule";
import type { TaskScheduleWithTask, TaskSchedule } from "@/types/domain/schedule";

/**
 * Get task schedules for a date range
 * 
 * @param startDate Start date of the range
 * @param endDate End date of the range
 * @param excludeApproved Whether to exclude approved tasks (default: true)
 * @param userId Optional user ID to view specific user's schedules (admin only, read-only mode)
 */
export function useTaskSchedules(
  startDate: Date,
  endDate: Date,
  excludeApproved: boolean = true,
  userId?: string
) {
  const queryClient = useQueryClient();
  
  // Date 객체를 ISO 문자열로 변환하여 쿼리 키의 일관성 보장
  const startDateStr = startDate.toISOString();
  const endDateStr = endDate.toISOString();
  
  return useQuery<TaskScheduleWithTask[]>({
    queryKey: ["task-schedules", startDateStr, endDateStr, excludeApproved, userId],
    queryFn: () => getTaskSchedules(startDate, endDate, excludeApproved, userId),
    staleTime: 0, // 항상 최신 데이터를 가져오도록 설정 (prev/next 버튼 클릭 시 무조건 새 데이터)
    enabled: true, // Always enabled, userId can be undefined
    placeholderData: (previousData) => {
      // 이전 쿼리의 데이터를 placeholder로 사용 (캘린더 즉시 이동, 데이터는 백그라운드에서 로드)
      return previousData;
    },
  });
}

/**
 * Update task schedule mutation
 * @param startDate Optional start date to invalidate specific query
 * @param endDate Optional end date to invalidate specific query
 * @param userId Optional user ID to invalidate specific user's query
 */
export function useUpdateTaskSchedule(startDate?: Date, endDate?: Date, userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: {
        start_time?: Date;
        end_time?: Date;
        is_all_day?: boolean;
      };
    }) => updateTaskSchedule(id, updates),
    onSuccess: () => {
      // 특정 날짜 범위의 쿼리만 무효화 (전체 무효화 대신)
      if (startDate && endDate) {
        // Date 객체를 ISO 문자열로 변환
        const startDateStr = startDate.toISOString();
        const endDateStr = endDate.toISOString();
        
        // userId가 있으면 해당 사용자의 쿼리만 무효화
        // userId가 없으면(undefined) 모든 사용자의 쿼리 무효화
        queryClient.invalidateQueries({ 
          queryKey: ["task-schedules", startDateStr, endDateStr, true, userId] 
        });
        queryClient.invalidateQueries({ 
          queryKey: ["task-schedules", startDateStr, endDateStr, false, userId] 
        });
        // userId가 undefined일 때는 모든 userId에 대한 쿼리도 무효화
        if (userId === undefined) {
          queryClient.invalidateQueries({ 
            queryKey: ["task-schedules", startDateStr, endDateStr, true] 
          });
          queryClient.invalidateQueries({ 
            queryKey: ["task-schedules", startDateStr, endDateStr, false] 
          });
        }
      } else {
        // 날짜 범위가 없으면 전체 무효화 (fallback)
        queryClient.invalidateQueries({ queryKey: ["task-schedules"] });
      }
    },
  });
}
