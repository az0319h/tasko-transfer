import * as z from "zod";

const PHONE_REGEX = /^010-\d{4}-\d{4}$/;

export const profileUpdateSchema = z.object({
  full_name: z.string().min(1, "이름은 필수입니다.").max(10, "이름은 10자 이하여야 합니다."),
  position: z.string().min(1, "직책은 필수입니다.").max(10, "직책은 10자 이하여야 합니다."),
  phone: z
    .string()
    .length(13, "전화번호는 010-0000-0000 형식의 13자여야 합니다.")
    .regex(PHONE_REGEX, "전화번호는 010-0000-0000 형식으로 입력해야 합니다."),
});

export type ProfileUpdateFormValues = z.infer<typeof profileUpdateSchema>;

export const profileCreateSchema = z.object({
  full_name: z.string().min(1, "이름은 필수입니다.").max(10, "이름은 10자 이하여야 합니다."),
  position: z.string().min(1, "직책은 필수입니다.").max(10, "직책은 10자 이하여야 합니다."),
  phone: z
    .string()
    .length(13, "전화번호는 010-0000-0000 형식의 13자여야 합니다.")
    .regex(PHONE_REGEX, "전화번호는 010-0000-0000 형식으로 입력해야 합니다."),
});

export type ProfileCreateFormValues = z.infer<typeof profileCreateSchema>;
