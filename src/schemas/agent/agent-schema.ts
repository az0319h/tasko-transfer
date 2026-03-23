import * as z from "zod";

/**
 * 에이전트 생성 스키마
 * 모든 필드는 필수입니다.
 */
export const agentCreateSchema = z.object({
  name: z.string().min(1, "에이전트 이름은 필수입니다.").max(100, "에이전트 이름은 100자 이하여야 합니다."),
  description: z.string().min(1, "간략한 설명은 필수입니다.").max(500, "간략한 설명은 500자 이하여야 합니다."),
  detailed_description: z.string().min(1, "구체적인 설명은 필수입니다.").max(5000, "구체적인 설명은 5000자 이하여야 합니다."),
  features: z.array(z.string().min(1, "특징은 비어있을 수 없습니다.").max(200, "각 특징은 200자 이하여야 합니다.")).min(1, "최소 1개 이상의 특징을 입력해주세요."),
  site_url: z.string().url("올바른 URL 형식이 아닙니다.").min(1, "에이전트 사이트 URL은 필수입니다."),
  site_media_file: z.instanceof(File, { message: "대표 미디어 파일은 필수입니다." }),
  site_media_type: z.enum(["image", "video"], { message: "미디어 타입을 선택해주세요." }),
});

/**
 * 에이전트 수정 스키마
 * 미디어 파일은 선택사항입니다 (기존 미디어 유지 가능).
 */
export const agentUpdateSchema = z.object({
  name: z.string().min(1, "에이전트 이름은 필수입니다.").max(100, "에이전트 이름은 100자 이하여야 합니다."),
  description: z.string().min(1, "간략한 설명은 필수입니다.").max(500, "간략한 설명은 500자 이하여야 합니다."),
  detailed_description: z.string().min(1, "구체적인 설명은 필수입니다.").max(5000, "구체적인 설명은 5000자 이하여야 합니다."),
  features: z.array(z.string().min(1, "특징은 비어있을 수 없습니다.").max(200, "각 특징은 200자 이하여야 합니다.")).min(1, "최소 1개 이상의 특징을 입력해주세요."),
  site_url: z.string().url("올바른 URL 형식이 아닙니다.").min(1, "에이전트 사이트 URL은 필수입니다."),
  site_media_file: z.instanceof(File).optional(),
  site_media_type: z.enum(["image", "video"]).optional(),
});

export type AgentCreateFormValues = z.infer<typeof agentCreateSchema>;
export type AgentUpdateFormValues = z.infer<typeof agentUpdateSchema>;
