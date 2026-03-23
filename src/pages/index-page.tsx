import { useIsAdmin } from "@/hooks";
import DefaultSpinner from "@/components/common/default-spinner";
import AdminDashboardPage from "./admin-dashboard-page";
import MemberDashboardPage from "./member-dashboard-page";

/**
 * 홈 대시보드 - 역할별 대시보드 분기
 */
export default function IndexPage() {
  const { data: isAdmin, isLoading } = useIsAdmin();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <DefaultSpinner />
      </div>
    );
  }

  if (isAdmin) {
    return <AdminDashboardPage />;
  }

  return <MemberDashboardPage />;
}
