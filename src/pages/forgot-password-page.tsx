import { ForgotPasswordForm } from "@/components/form/forgot-password-form";
import logo_dark from "@/assets/logo_dark.png";
import logo_light from "@/assets/logo_light.png";
import { getResolvedThemeMode } from "@/lib/utils";

export default function ForgotPasswordPage() {
  const mode = getResolvedThemeMode();
  return (
    <>
      {/* <SEO title="비밀번호 찾기" description="비밀번호를 재설정할 수 있습니다." /> */}
      <div className="grid min-h-svh lg:grid-cols-2">
        <div className="flex flex-col gap-4 p-6 md:p-10">
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-100">
              <ForgotPasswordForm />
            </div>
          </div>
        </div>
        <div className="bg-muted relative hidden lg:block">
          <img
            src={mode === "dark" ? logo_light : logo_dark}
            alt="logo"
            className="absolute top-1/2 left-1/2 max-w-75 -translate-x-1/2 -translate-y-1/2 object-cover dark:brightness-[0.2] dark:grayscale"
          />
        </div>
      </div>
    </>
  );
}
