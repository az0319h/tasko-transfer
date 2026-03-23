import { useCurrentProfile } from "@/hooks";
import { Navigate, Outlet } from "react-router";
import DefaultSpinner from "../common/default-spinner";

/**
 * 프로필이 필수인 레이아웃
 * 프로필이 없으면 프로필 설정 페이지로 리다이렉트
 */
export default function ProfileRequiredLayout() {
  const { data: profile, isLoading, isError } = useCurrentProfile();

  if (isLoading) {
    return <DefaultSpinner />;
  }

  // 프로필이 없거나 프로필이 완성되지 않았거나 이름이 없으면 프로필 설정 페이지로 리다이렉트
  if (isError || !profile || !profile.profile_completed || !profile.full_name) {
    return <Navigate to="/profile/setup" replace={true} />;
  }

  return <Outlet />;
}

