import supabase from "@/lib/supabase";

export interface LinkPreviewData {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

/**
 * 링크 미리보기 데이터 조회
 * Edge Function을 통해 URL의 Open Graph 메타데이터를 가져옵니다.
 */
export async function getLinkPreview(url: string): Promise<LinkPreviewData> {
  // URL 검증
  if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
    throw new Error("유효한 HTTP/HTTPS URL이 필요합니다.");
  }

  const { data, error } = await supabase.functions.invoke("get-link-preview", {
    body: { url },
  });

  if (error) {
    console.error("[getLinkPreview] Edge Function 에러:", error);
    throw new Error(error.message || "링크 미리보기를 가져올 수 없습니다.");
  }

  if (data?.error) {
    console.error("[getLinkPreview] 응답 에러:", data.error);
    throw new Error(data.error);
  }

  return data as LinkPreviewData;
}
