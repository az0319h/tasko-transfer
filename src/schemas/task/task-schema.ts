import { z } from "zod";

/**
 * Task 카테고리 타입
 */
export type TaskCategory = "REVIEW" | "REVISION" | "CONTRACT" | "SPECIFICATION" | "APPLICATION";

/**
 * Task 생성 스키마
 * assigner_id는 자동으로 현재 로그인한 사용자로 설정됨
 * task_category는 필수 필드 (생성 후 변경 불가)
 */
export const taskCreateSchema = z.object({
  title: z.string().min(1, "제목을 입력해주세요.").max(200, "제목은 200자 이하여야 합니다."),
  description: z.string().max(1000, "설명은 1000자 이하여야 합니다.").optional().nullable(),
  assignee_id: z.string().uuid("올바른 할당받은 사람 ID를 선택해주세요."),
  task_category: z.enum(["REVIEW", "REVISION", "CONTRACT", "SPECIFICATION", "APPLICATION"], {
    message: "카테고리를 선택해주세요.",
  }),
  client_name: z.string().min(1, "고객명을 입력해주세요.").max(100, "고객명은 100자 이하여야 합니다."),
  due_date: z.string().min(1, "마감일을 입력해주세요.").refine(
    (val) => {
      const selectedDate = new Date(val);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      selectedDate.setHours(0, 0, 0, 0);
      return selectedDate >= today;
    },
    { message: "마감일은 오늘 날짜를 포함한 이후 날짜만 선택할 수 있습니다." }
  ),
  reference_ids: z.array(z.string().uuid()).optional().default([]),
});

/**
 * 자기 할당 Task 생성 스키마
 * assignee_id는 자동으로 현재 로그인한 사용자로 설정되므로 필수 아님
 */
export const taskCreateSelfTaskSchema = z.object({
  title: z.string().min(1, "제목을 입력해주세요.").max(200, "제목은 200자 이하여야 합니다."),
  description: z.string().max(1000, "설명은 1000자 이하여야 합니다.").optional().nullable(),
  task_category: z.enum(["REVIEW", "REVISION", "CONTRACT", "SPECIFICATION", "APPLICATION"], {
    message: "카테고리를 선택해주세요.",
  }),
  client_name: z.string().min(1, "고객명을 입력해주세요.").max(100, "고객명은 100자 이하여야 합니다."),
  due_date: z.string().min(1, "마감일을 입력해주세요.").refine(
    (val) => {
      const selectedDate = new Date(val);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      selectedDate.setHours(0, 0, 0, 0);
      return selectedDate >= today;
    },
    { message: "마감일은 오늘 날짜를 포함한 이후 날짜만 선택할 수 있습니다." }
  ),
  reference_ids: z.array(z.string().uuid()).optional().default([]),
});

/**
 * 명세서 모드용 Task 생성 스키마
 * 명세서 모드에서는 title이 자동 생성되므로 optional
 * 두 개의 마감일 필드: 청구항 및 도면, 초안 작성
 */
export const taskCreateSpecificationSchema = z.object({
  title: z.string().optional(), // 명세서 모드에서는 title 불필요 (자동 생성)
  description: z.string().max(1000, "설명은 1000자 이하여야 합니다.").optional().nullable(),
  assignee_id: z.string().uuid("올바른 할당받은 사람 ID를 선택해주세요."),
  task_category: z.literal("SPECIFICATION", {
    message: "카테고리를 선택해주세요.",
  }),
  client_name: z.string().min(1, "고객명을 입력해주세요.").max(100, "고객명은 100자 이하여야 합니다."),
  due_date_claim_drawing: z.string().min(1, "청구항 및 도면 마감일을 입력해주세요.").refine(
    (val) => {
      const selectedDate = new Date(val);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      selectedDate.setHours(0, 0, 0, 0);
      return selectedDate >= today;
    },
    { message: "마감일은 오늘 날짜를 포함한 이후 날짜만 선택할 수 있습니다." }
  ),
  due_date_draft: z.string().min(1, "초안 작성 마감일을 입력해주세요.").refine(
    (val) => {
      const selectedDate = new Date(val);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      selectedDate.setHours(0, 0, 0, 0);
      return selectedDate >= today;
    },
    { message: "마감일은 오늘 날짜를 포함한 이후 날짜만 선택할 수 있습니다." }
  ),
  reference_ids: z.array(z.string().uuid()).optional().default([]),
});

/**
 * Task 수정 스키마
 * assigner_id와 assignee_id는 수정 불가이므로 제외
 * 허용 필드: title, description, due_date, client_name
 */
export const taskUpdateSchema = z.object({
  title: z.string().min(1, "제목을 입력해주세요.").max(200, "제목은 200자 이하여야 합니다."),
  description: z.string().max(1000, "설명은 1000자 이하여야 합니다.").optional().nullable(),
  client_name: z.string().min(1, "고객명을 입력해주세요.").max(100, "고객명은 100자 이하여야 합니다."),
  due_date: z.string().min(1, "마감일을 입력해주세요.").refine(
    (val) => {
      const selectedDate = new Date(val);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      selectedDate.setHours(0, 0, 0, 0);
      return selectedDate >= today;
    },
    { message: "마감일은 오늘 날짜를 포함한 이후 날짜만 선택할 수 있습니다." }
  ),
});

/**
 * Task 생성/수정 폼 데이터 타입
 * 생성 모드: taskCreateSchema 사용 (일반 모드)
 * 자기 할당 Task 모드: taskCreateSelfTaskSchema 사용
 * 명세서 모드: taskCreateSpecificationSchema 사용
 * 수정 모드: taskUpdateSchema 사용
 */
export type TaskCreateFormData = z.infer<typeof taskCreateSchema>;
export type TaskCreateSelfTaskFormData = z.infer<typeof taskCreateSelfTaskSchema>;
export type TaskCreateSpecificationFormData = z.infer<typeof taskCreateSpecificationSchema>;
export type TaskUpdateFormData = z.infer<typeof taskUpdateSchema>;
export type TaskFormData = TaskCreateFormData | TaskCreateSelfTaskFormData | TaskCreateSpecificationFormData | TaskUpdateFormData;

// 하위 호환성을 위해 taskSchema export (생성 모드용)
export const taskSchema = taskCreateSchema;

