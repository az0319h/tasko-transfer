import * as z from "zod";
import { emailSchema } from "../common/email-schema";

export const changeEmailSchema = z
  .object({
    currentPassword: z.string().min(1, "기존 비밀번호를 입력해주세요."),
    newEmail: emailSchema,
    confirmEmail: emailSchema,
  })
  .refine((data) => data.newEmail === data.confirmEmail, {
    message: "이메일이 일치하지 않습니다.",
    path: ["confirmEmail"],
  });

export type ChangeEmailFormValues = z.infer<typeof changeEmailSchema>;

