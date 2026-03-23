import { SEO } from "@/components/common/seo";
import { ProfileSetupForm } from "@/components/form/profile-setup-form";
import { useTranslation } from "react-i18next";

export default function ProfileSetupPage() {
  const { t } = useTranslation();

  return (
    <>
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <ProfileSetupForm />
        </div>
      </div>
    </>
  );
}
