import { Link } from "react-router";
import error_404_dark from "@/assets/error_404_dark.svg";
import error_404_light from "@/assets/error_404_light.svg";
import { useResolvedThemeMode } from "@/hooks";
import { useTranslation } from "react-i18next";

export default function NotfoundPage() {
  const { t } = useTranslation();
  const mode = useResolvedThemeMode();
  return (
    <div className="bg-background fixed inset-0 z-50 flex items-center justify-center px-7.5">
      <div className="xs:gap-8 flex max-w-175 flex-col-reverse items-center md:grid md:grid-cols-2 md:gap-0">
        <div className="flex flex-col gap-5">
          <h2 className="text-32-medium font-medium md:text-5xl md:leading-14">
            {t("notFound.title")}
          </h2>
          <div className="sm:grid sm:grid-cols-8">
            <p className="text-16-regular md:text-20-regular sm:col-start-1 sm:col-end-6 md:col-end-8">
              {t("notFound.description")}
            </p>
          </div>
          <Link
            to={"/"}
            className="hover:bg-background hover:text-foreground bg-foreground text-background text-16-medium mt-5 block w-fit px-10 py-5 transition-all duration-300 hover:outline-1"
          >
            {t("notFound.backToHome")}
          </Link>
        </div>
        <div>
          {mode === "light" ? (
            <img src={error_404_dark} alt="error_404" className="xs:w-75 sm:h-[20vh] sm:w-100" />
          ) : (
            <img src={error_404_light} alt="error_404" className="xs:w-75 sm:h-[20vh] sm:w-100" />
          )}
        </div>
      </div>
    </div>
  );
}
