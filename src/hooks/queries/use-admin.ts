import { getUsers } from "@/api/admin";
import { useQuery } from "@tanstack/react-query";

export function useUsers() {
  return useQuery({
    queryKey: ["admin", "users"],
    queryFn: getUsers,
    retry: false,
  });
}


