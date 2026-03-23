import { useState } from "react";
import { useLinkPreview } from "@/hooks/queries/use-link-preview";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface LinkPreviewCardProps {
  url: string;
  isMine?: boolean;
}

/**
 * 링크 미리보기 카드 컴포넌트
 * URL의 Open Graph 메타데이터를 표시합니다.
 */
export function LinkPreviewCard({ url, isMine = false }: LinkPreviewCardProps) {
  const { data, isLoading, error } = useLinkPreview(url);
  const [imageError, setImageError] = useState(false);

  // 에러 발생 시 미리보기 숨김
  if (error) {
    return null;
  }

  // 로딩 중
  if (isLoading) {
    return (
      <div
        className={cn(
          "mt-2 flex w-fit items-center justify-center rounded-lg border border-border bg-muted/50 px-3 py-2",
          isMine ? "ml-auto" : "mr-auto",
        )}
      >
        <Spinner />
        <span className="ml-2 text-xs text-muted-foreground">링크 미리보기 로딩 중...</span>
      </div>
    );
  }

  // 데이터가 없으면 숨김
  if (!data || (!data.title && !data.description && !data.image)) {
    return null;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleImageError = () => {
    setImageError(true);
  };

  return (
    <div
      className={cn(
        "group relative mt-2 w-fit max-w-[400px] overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-all hover:shadow-md",
        isMine ? "ml-auto" : "mr-auto",
      )}
    >
      {/* 클릭 가능한 영역 */}
      <button
        onClick={handleClick}
        className="block w-full text-left focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        {/* 이미지 영역 (위) */}
        {data.image && !imageError && (
          <div className="relative w-full overflow-hidden bg-muted">
            <img
              src={data.image}
              alt={data.title || "링크 미리보기 이미지"}
              className="h-auto w-full object-cover"
              onError={handleImageError}
            />
          </div>
        )}

        {/* 텍스트 정보 영역 (아래) */}
        <div className="px-3 py-2 sm:px-3 sm:py-2">
          {/* 제목 */}
          {data.title && (
            <h3 className="mb-1 line-clamp-2 text-sm font-semibold text-foreground sm:text-base">
              {data.title}
            </h3>
          )}

          {/* 설명 */}
          {data.description && (
            <p className="mb-1 line-clamp-2 text-xs text-muted-foreground sm:text-sm">
              {data.description}
            </p>
          )}

          {/* 도메인 */}
          <span className="text-[10px] text-muted-foreground sm:text-xs">
            {new URL(url).hostname.replace("www.", "")}
          </span>
        </div>
      </button>
    </div>
  );
}
