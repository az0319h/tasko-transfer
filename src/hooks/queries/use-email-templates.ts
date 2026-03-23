import { useQuery } from "@tanstack/react-query";
import { getEmailTemplates } from "@/api/confirm-email";

export function useEmailTemplates() {
  return useQuery({
    queryKey: ["email-templates"],
    queryFn: getEmailTemplates,
    staleTime: 5 * 60 * 1000,
  });
}
