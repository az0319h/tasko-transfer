import { useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router";
import { SEO } from "@/components/common/seo";
import { useAgents } from "@/hooks";
import DefaultSpinner from "@/components/common/default-spinner";
import { Plus, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types/domain/agent";
import supabase from "@/lib/supabase";
import { AgentFormDialog } from "@/components/agent/agent-form-dialog";

/**
 * 에이전트 카드 컴포넌트
 */
function AgentCard({
  agent,
  onClick,
}: {
  agent: Agent;
  onClick: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // 미디어 공개 URL 생성
  let mediaUrl: string | null = null;
  if (agent.site_media_url) {
    const {
      data: { publicUrl },
    } = supabase.storage.from("agents").getPublicUrl(agent.site_media_url);
    mediaUrl = publicUrl;
  }

  // hover 시 비디오 재생/정지
  const handleMouseEnter = () => {
    if (videoRef.current && agent.site_media_type === "video") {
      videoRef.current.play().catch(() => {
        // 자동 재생 실패 시 무시 (브라우저 정책)
      });
    }
  };

  const handleMouseLeave = () => {
    if (videoRef.current && agent.site_media_type === "video") {
      videoRef.current.pause();
      videoRef.current.currentTime = 0; // 처음으로 되돌림
    }
  };

  return (
    <div
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-lg border bg-card",
        "flex flex-col transition-all duration-300 ease-in-out",
        "hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/20",
        "hover:border-primary/20"
      )}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* 미디어 영역 */}
      <div className="relative aspect-video w-full overflow-hidden  p-6">
        {mediaUrl && agent.site_media_type === "image" ? (
          <img
            src={mediaUrl}
            alt={agent.name}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : mediaUrl && agent.site_media_type === "video" ? (
          <video
            ref={videoRef}
            src={mediaUrl}
            className="h-full w-full object-cover"
            muted
            playsInline
            loop
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Bot className="size-12 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* 내용 영역 */}
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex items-center gap-2">
          <h3 className="line-clamp-1 text-16-semibold">{agent.name}</h3>
          <span className="text-12-medium text-muted-foreground">
            {agent.features?.length || 0}개 이상의 구성 요소
          </span>
        </div>
        <p className="line-clamp-2 flex-1 text-14-medium ">
          {agent.description}
        </p>
      </div>
    </div>
  );
}

export default function AgentsPage() {
  const navigate = useNavigate();
  const { data: agents, isLoading, isError } = useAgents();

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(12); // 그리드 레이아웃용 고정 크기
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // 페이지네이션 적용
  const paginatedAgents = useMemo(() => {
    if (!agents) return [];
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return agents.slice(startIndex, endIndex);
  }, [agents, currentPage, pageSize]);

  const totalItems = agents?.length || 0;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  if (isLoading) {
    return <DefaultSpinner />;
  }

  if (isError) {
    return (
      <div className="w-full p-4">
        <p className="text-muted-foreground text-center">에이전트 목록을 불러올 수 없습니다.</p>
      </div>
    );
  }

  return (
    <>
      <div className="w-full md:p-4">
        {/* 헤더 */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="mb-2  text-20-semibold  md:text-24-semibold">AI 에이전트</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              에이전트를 공유하고 다른 사람이 만든 에이전트를 확인하세요
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)} className="shrink-0">
            <Plus className="mr-2 size-4" />
            에이전트 추가
          </Button>
        </div>

        {/* 에이전트 목록 */}
        {paginatedAgents && paginatedAgents.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3 xl:gap-10">
              {paginatedAgents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onClick={() => navigate(`/agents/${agent.id}`)}
                />
              ))}
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  이전
                </Button>
                <span className="text-sm text-muted-foreground">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  다음
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="py-12 text-center">
            <Bot className="mx-auto mb-4 size-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              등록된 에이전트가 없습니다.
            </p>
          </div>
        )}
      </div>

      {/* 생성 모달 */}
      <AgentFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </>
  );
}
