import { SEO } from "@/components/common/seo";
import { useCurrentProfile } from "@/hooks";
import { useTranslation } from "react-i18next";
import DefaultSpinner from "@/components/common/default-spinner";
import { Button } from "@/components/ui/button";
import EditProfileDialog from "@/components/dialog/edit-profile-dialog";
import { Pencil, Mail, Phone, Calendar, Shield } from "lucide-react";
import LogoutDialog from "@/components/dialog/logout-dialog";
import { ProfileAvatar } from "@/components/common/profile-avatar";

export default function ProfilePage() {
  const { t } = useTranslation();
  const { data: profile, isLoading } = useCurrentProfile();

  if (isLoading) {
    return <DefaultSpinner />;
  }

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <>
      <div className="container mx-auto max-w-5xl p-4">
        {/* 프로필 헤더 영역 */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6 lg:gap-8">
          {/* 프로필 이미지와 이름 영역 */}
          <div className="flex flex-col items-center gap-4 sm:min-w-0 sm:flex-1 sm:flex-row sm:items-start sm:gap-6 lg:gap-8">
            <ProfileAvatar avatarUrl={profile?.avatar_url} size={120} className="shrink-0" />
            <div className="flex-1 text-center sm:min-w-0 sm:text-left">
              <h1 className="mb-2 line-clamp-2 text-2xl font-bold sm:text-3xl lg:text-4xl">
                {profile?.full_name || "-"}님
              </h1>
              {profile?.position && (
                <p className="text-muted-foreground text-base break-words sm:text-lg lg:text-xl">
                  {profile.position}
                </p>
              )}
            </div>
          </div>

          {/* 버튼 영역 */}
          <div className="flex flex-col gap-2 sm:shrink-0 sm:flex-row sm:items-start">
            <EditProfileDialog>
              <Button
                variant="outline"
                className="w-full  whitespace-nowrap sm:w-auto"
              >
                <Pencil className="mr-2 size-4" />
                수정
              </Button>
            </EditProfileDialog>
            <LogoutDialog>
              <Button className="w-full whitespace-nowrap sm:w-auto">로그아웃</Button>
            </LogoutDialog>
          </div>
        </div>

        {/* 교훈 및 영감 섹션 */}
        <div className="mb-8 space-y-4 sm:mb-10 lg:mb-12">
          <h2 className="text-lg font-semibold sm:text-xl lg:text-2xl">Tasko의 생각</h2>
          <div className="text-muted-foreground space-y-4 text-sm leading-relaxed sm:text-base lg:text-lg">
            <p>
              당신의 프로필은 단순한 정보의 나열이 아닙니다. 그것은 당신의 이야기이고, 당신이 걸어온
              길의 기록입니다. 매일 조금씩 성장하고 변화하는 모습을 이곳에 담아보세요. 작은 변화도
              쌓이면 큰 성장이 됩니다.
            </p>
            <p>
              혼자 가면 빠르지만, 함께 가면 멀리 갈 수 있습니다. 이 프로필은 팀원들과의 협업에서
              당신을 나타내는 중요한 도구입니다. 정확하고 최신의 정보를 유지하는 것은 서로에 대한
              신뢰를 쌓는 첫걸음입니다. 프로필을 업데이트하는 것은 단순한 정보 수정이 아니라, 팀과의
              소통을 위한 준비입니다.
            </p>
            <p>
              성공은 하루아침에 이루어지지 않습니다. 매일 조금씩 노력하고, 작은 목표를 달성하며,
              실수를 통해 배우는 과정이 바로 성장입니다. 오늘도 한 걸음씩 앞으로 나아가고 있다면,
              그것만으로도 충분히 의미 있는 하루입니다. Tasko에서 당신의 여정을 응원합니다.
            </p>
          </div>
        </div>

        {/* 연락처 정보 영역 */}
        <div className="space-y-4 sm:space-y-5 lg:space-y-6">
          {/* 이메일 */}
          {profile?.email && (
            <div className="flex items-center gap-3 sm:gap-4">
              <Mail className="text-muted-foreground size-5 shrink-0 sm:size-6" />
              <span className="text-sm break-all sm:text-base lg:text-lg">{profile.email}</span>
            </div>
          )}

          {/* 전화번호 */}
          {profile?.phone && (
            <div className="flex items-center gap-3 sm:gap-4">
              <Phone className="text-muted-foreground size-5 shrink-0 sm:size-6" />
              <span className="text-sm break-all sm:text-base lg:text-lg">{profile.phone}</span>
            </div>
          )}

          {/* 역할 */}
          <div className="flex items-center gap-3 sm:gap-4">
            <Shield className="text-muted-foreground size-5 shrink-0 sm:size-6" />
            <span
              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                profile?.role === "admin"
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {profile?.role === "admin" ? "관리자" : "멤버"}
            </span>
          </div>

          {/* 가입일 */}
          {profile?.created_at && (
            <div className="flex items-center gap-3 sm:gap-4">
              <Calendar className="text-muted-foreground size-5 shrink-0 sm:size-6" />
              <span className="text-muted-foreground text-sm sm:text-base lg:text-lg">
                가입일: {formatDate(profile.created_at)}
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
