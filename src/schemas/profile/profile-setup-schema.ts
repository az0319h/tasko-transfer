import * as z from "zod";
import { passwordSchema } from "../common/password-schema";

const PHONE_REGEX = /^010-\d{4}-\d{4}$/;

export const profileSetupSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "비밀번호 확인을 입력해주세요."),
    full_name: z.string().min(1, "이름은 필수입니다.").max(10, "이름은 10자 이하여야 합니다."),
    position: z.string().min(1, "직책은 필수입니다.").max(10, "직책은 10자 이하여야 합니다."),
    phone: z
      .string()
      .length(13, "전화번호는 010-0000-0000 형식의 13자여야 합니다.")
      .regex(PHONE_REGEX, "전화번호는 010-0000-0000 형식으로 입력해야 합니다."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["confirmPassword"],
  });

export type ProfileSetupFormValues = z.infer<typeof profileSetupSchema>;


