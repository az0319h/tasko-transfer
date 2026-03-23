// src/components/common/default-seo.tsx
import { useEffect } from "react";
import { Title, Meta } from "react-head";

export function DefaultSeo() {
  useEffect(() => {
    document.documentElement.lang = "ko";
  }, []);

  // SEO 기본 정보
  const siteTitle = "Tasko - 업무 관리 협업 플랫폼";
  const siteDescription =
    "Tasko는 회사 내부에서 업무 할당, 진행, 승인 및 진행되는 업무를 한 곳에서 관리하기 위한 협업 플랫폼입니다.";
  const keywords =
    "Tasko, 업무 관리, 협업 플랫폼, 프로젝트 관리, 업무 할당, 승인 시스템, 팀 커뮤니케이션, 워크플로우";
  const siteUrl = import.meta.env.VITE_FRONTEND_URL || "https://tasko.app";
  // 이미지 URL은 나중에 추가할 예정
  const ogImage = `${siteUrl}/images/og-image.png`;
  const twitterImage = `${siteUrl}/images/og-image.png`;

  return (
    <>
      {/* 기본 메타 태그 */}
      <Title>{siteTitle}</Title>
      <Meta name="description" content={siteDescription} />
      <Meta name="keywords" content={keywords} />
      <Meta name="robots" content="index,follow" />
      <Meta name="viewport" content="width=device-width, initial-scale=1.0" />

      {/* Open Graph 메타 태그 */}
      <Meta property="og:type" content="website" />
      <Meta property="og:title" content={siteTitle} />
      <Meta property="og:description" content={siteDescription} />
      <Meta property="og:locale" content="ko_KR" />
      <Meta property="og:url" content={siteUrl} />
      <Meta property="og:site_name" content="Tasko" />
      <Meta property="og:image" content={ogImage} />
      <Meta property="og:image:width" content="1200" />
      <Meta property="og:image:height" content="630" />
      <Meta property="og:image:alt" content="Tasko - 업무 관리 협업 플랫폼" />

      {/* 트위터 카드 메타 태그 */}
      <Meta name="twitter:card" content="summary_large_image" />
      <Meta name="twitter:title" content={siteTitle} />
      <Meta name="twitter:description" content={siteDescription} />
      <Meta name="twitter:image" content={twitterImage} />
      <Meta name="twitter:image:alt" content="Tasko - 업무 관리 협업 플랫폼" />
      {/* 필요시 트위터 계정 추가 */}
      {/* <Meta name="twitter:site" content="@tasko" /> */}
      {/* <Meta name="twitter:creator" content="@tasko" /> */}
    </>
  );
}
