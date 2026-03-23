import { useIsAdmin } from "@/hooks";
import { Navigate, Outlet } from "react-router";
import DefaultSpinner from "../common/default-spinner";

/**
 * Admin 전용 레이아웃
 * Admin이 아니면 홈으로 리다이렉트
 */
export default function AdminOnlyLayout() {
  const { data: isAdmin, isLoading, isError } = useIsAdmin();

  if (isLoading) {
    return <DefaultSpinner />;
  }

  if (isError || !isAdmin) {
    return <Navigate to="/" replace={true} />;
  }

  return <Outlet />;
}


