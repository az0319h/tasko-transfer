import * as z from "zod";

export const passwordSchema = z
  .string()
  .min(8, "비밀번호는 최소 8자 이상이어야 합니다.")
  .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, "비밀번호는 문자와 숫자를 모두 포함해야 합니다.");
