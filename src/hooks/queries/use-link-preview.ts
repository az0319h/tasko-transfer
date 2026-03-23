import { useQuery } from "@tanstack/react-query";
import { getLinkPreview, type LinkPreviewData } from "@/api/link-preview";

/**
 * 링크 미리보기 데이터 조회 훅
 * React Query로 링크 미리보기 데이터를 조회하고 캐싱합니다.
 * 
 * @param url 미리보기를 가져올 URL
 */
export function useLinkPreview(url: string | undefined) {
  return useQuery<LinkPreviewData>({
    queryKey: ["link-preview", url],
    queryFn: () => (url ? getLinkPreview(url) : Promise.reject(new Error("URL이 필요합니다."))),
    enabled: !!url && (url.startsWith("http://") || url.startsWith("https://")),
    staleTime: 24 * 60 * 60 * 1000, // 24시간 캐시
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7일간 보관
    retry: 1, // 실패 시 1번만 재시도
    retryDelay: 1000, // 1초 후 재시도
  });
}
