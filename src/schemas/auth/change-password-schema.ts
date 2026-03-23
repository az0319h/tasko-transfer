import * as z from "zod";
import { passwordSchema } from "../common/password-schema";

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "기존 비밀번호를 입력해주세요."),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "비밀번호 확인을 입력해주세요."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "새 비밀번호는 기존 비밀번호와 달라야 합니다.",
    path: ["newPassword"],
  });

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

