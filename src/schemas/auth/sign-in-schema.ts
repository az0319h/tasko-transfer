import * as z from "zod";
import { emailSchema } from "../common/email-schema";
import { passwordSchema } from "../common/password-schema";

export const signInSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export type SigninFormValues = z.infer<typeof signInSchema>;
