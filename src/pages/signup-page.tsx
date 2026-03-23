import { SEO } from "@/components/common/seo";
import { SignupForm } from "@/components/form/signup-form";
import { useTranslation } from "react-i18next";

export default function SignupPage() {
  const { t } = useTranslation();

  return (
    <>
      <div className="z-30 flex min-h-screen w-full items-center justify-center py-8">
        <div className="w-full max-w-md px-4">
          <SignupForm />
        </div>
      </div>
    </>
  );
}
