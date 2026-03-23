// src/components/common/seo.tsx
import { Title, Meta } from "react-head";
import { useTranslation } from "react-i18next";

type SeoProps = {
  title?: string;
  description?: string;
};

export function SEO({ title, description }: SeoProps) {
  const { i18n } = useTranslation();
  const isKorean = i18n.language.startsWith("ko");

  const fallbackTitle = isKorean
    ? "캠밥 - 밥 한 끼, 술 한 잔으로 가까워지는 대학생활"
    : "CAMBOB - Meet over Meals and Drinks on Campus";

  const fallbackDesc = isKorean
    ? "캠밥은 대학생들이 밥이나 술을 함께하며 자연스럽게 친해질 수 있는 밥친·술친 매칭 플랫폼입니다."
    : "CAMBOB helps university students connect and make friends over shared meals or drinks — your campus meal & drink mate platform.";

  const finalTitle = title || fallbackTitle;
  const finalDesc = description || fallbackDesc;

  const keywords = isKorean
    ? "캠밥, 대학생, 밥약, 술약, 밥친, 술친, 대학친목, 밥메이트, 술자리, 미팅"
    : "CAMBOB, university, meal mate, drink mate, social campus, dining, meetup, student network";

  const ogLocale = isKorean ? "ko_KR" : "en_US";

  return (
    <>
      {/* 페이지 타이틀/메타 – DefaultSeo 의 값들을 덮어쓰기 */}
      <Title>{finalTitle}</Title>
      <Meta name="description" content={finalDesc} />
      <Meta name="keywords" content={keywords} />
      <Meta property="og:title" content={finalTitle} />
      <Meta property="og:description" content={finalDesc} />
      <Meta property="og:type" content="website" />
      <Meta property="og:locale" content={ogLocale} />
      <Meta name="robots" content="index,follow" />
    </>
  );
}
