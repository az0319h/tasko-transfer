/**
 * use-task.ts 테스트
 * setQueriesData에서 배열/단일 객체 쿼리 모두 안전하게 처리하는지 검증
 */

import { describe, it, expect } from "vitest";
import type { TaskWithProfiles } from "@/api/task";
import type { TaskStatus } from "@/lib/task-status";

/**
 * setQueriesData 콜백 로직 테스트
 * 실제 React Query 없이 순수 함수 로직만 테스트
 */
describe("useUpdateTaskStatus optimistic update logic", () => {
  const createMockTask = (id: string, status: TaskStatus): TaskWithProfiles => ({
    id,
    title: `Task ${id}`,
    assigner_id: "user-1",
    assignee_id: "user-2",
    task_category: "REVIEW",
    task_status: status,
    due_date: "2024-01-02T00:00:00Z",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    created_by: "user-1",
    client_name: "Test Client",
    send_email_to_client: false,
    assigner: {
      id: "user-1",
      full_name: "User 1",
      email: "user1@example.com",
      avatar_url: null,
    },
    assignee: {
      id: "user-2",
      full_name: "User 2",
      email: "user2@example.com",
      avatar_url: null,
    },
  } as TaskWithProfiles);

  // setQueriesData 콜백 로직 (실제 코드에서 추출)
  const optimisticUpdateCallback = (
    old: TaskWithProfiles[] | TaskWithProfiles | null,
    taskId: string,
    newStatus: TaskStatus,
  ): TaskWithProfiles[] | TaskWithProfiles | null => {
    if (!old) return old;

    // 배열인 경우 (프로젝트별 Task 목록 쿼리)
    if (Array.isArray(old)) {
      return old.map((task) =>
        task.id === taskId ? { ...task, task_status: newStatus } : task,
      );
    }

    // 단일 객체인 경우 (Task 상세 쿼리)
    if (typeof old === "object" && old !== null && "id" in old && old.id === taskId) {
      return { ...old, task_status: newStatus };
    }

    // 매칭되지 않는 경우 원본 반환
    return old;
  };

  it("배열 쿼리에서 Task 상태 업데이트", () => {
    const tasks: TaskWithProfiles[] = [
      createMockTask("task-1", "ASSIGNED"),
      createMockTask("task-2", "IN_PROGRESS"),
      createMockTask("task-3", "ASSIGNED"),
    ];

    const result = optimisticUpdateCallback(tasks, "task-2", "WAITING_CONFIRM");

    expect(Array.isArray(result)).toBe(true);
    expect((result as TaskWithProfiles[])[0].task_status).toBe("ASSIGNED");
    expect((result as TaskWithProfiles[])[1].task_status).toBe("WAITING_CONFIRM");
    expect((result as TaskWithProfiles[])[2].task_status).toBe("ASSIGNED");
  });

  it("단일 객체 쿼리에서 Task 상태 업데이트", () => {
    const task = createMockTask("task-1", "ASSIGNED");

    const result = optimisticUpdateCallback(task, "task-1", "IN_PROGRESS");

    expect(Array.isArray(result)).toBe(false);
    expect((result as TaskWithProfiles).task_status).toBe("IN_PROGRESS");
    expect((result as TaskWithProfiles).id).toBe("task-1");
  });

  it("단일 객체 쿼리에서 다른 Task ID는 변경하지 않음", () => {
    const task = createMockTask("task-1", "ASSIGNED");

    const result = optimisticUpdateCallback(task, "task-2", "IN_PROGRESS");

    expect((result as TaskWithProfiles).task_status).toBe("ASSIGNED");
    expect((result as TaskWithProfiles).id).toBe("task-1");
  });

  it("null 값은 그대로 반환", () => {
    const result = optimisticUpdateCallback(null, "task-1", "IN_PROGRESS");

    expect(result).toBe(null);
  });

  it("배열이 비어있어도 정상 처리", () => {
    const result = optimisticUpdateCallback([], "task-1", "IN_PROGRESS");

    expect(Array.isArray(result)).toBe(true);
    expect((result as TaskWithProfiles[]).length).toBe(0);
  });

  it("배열에서 매칭되지 않는 Task ID는 변경하지 않음", () => {
    const tasks: TaskWithProfiles[] = [
      createMockTask("task-1", "ASSIGNED"),
      createMockTask("task-2", "IN_PROGRESS"),
    ];

    const result = optimisticUpdateCallback(tasks, "task-999", "WAITING_CONFIRM");

    expect((result as TaskWithProfiles[])[0].task_status).toBe("ASSIGNED");
    expect((result as TaskWithProfiles[])[1].task_status).toBe("IN_PROGRESS");
  });
});


