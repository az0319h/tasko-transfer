import * as z from "zod";
import { emailSchema } from "../common/email-schema";

export const inviteUserSchema = z.object({
  email: emailSchema,
});

export type InviteUserFormValues = z.infer<typeof inviteUserSchema>;


