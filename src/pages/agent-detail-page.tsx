import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { SEO } from "@/components/common/seo";
import { useAgent, useCurrentProfile } from "@/hooks";
import { useDeleteAgent } from "@/hooks/mutations/use-agent";
import DefaultSpinner from "@/components/common/default-spinner";
import { Edit, Trash2, ExternalLink, Check, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import supabase from "@/lib/supabase";
import { AgentFormDialog } from "@/components/agent/agent-form-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import NotfoundPage from "./not-found-page";

export default function AgentDetailPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const { data: currentProfile } = useCurrentProfile();
  const { data: agent, isLoading, isError } = useAgent(agentId);
  const deleteAgent = useDeleteAgent();

  const [deleting, setDeleting] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // 소유자 확인
  const isOwner = agent && currentProfile?.id === agent.created_by;

  // 삭제 핸들러
  const handleDelete = async () => {
    if (!agentId) return;

    setDeleting(true);
    try {
      await deleteAgent.mutateAsync(agentId);
      navigate("/agents");
    } catch (error) {
      // 에러는 mutation에서 toast로 처리됨
    } finally {
      setDeleting(false);
    }
  };

  if (isLoading) {
    return <DefaultSpinner />;
  }

  if (isError || !agent) {
    return <NotfoundPage />;
  }

  // 미디어 공개 URL
  const mediaUrl = agent.media_public_url || null;

  return (
    <>
      <div className="w-full p-4">
        {/* 헤더 */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="mb-1 md:mb-2 text-20-semibold md:text-24-semibold">{agent.name}</h1>
            <p className="text-muted-foreground text-14-regular md:text-16-regular">
              {agent.description}
            </p>
          </div>

          {/* 액션 버튼 (소유자만) */}
          {isOwner && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setEditDialogOpen(true)}
              >
                <Edit className="mr-2 size-4" />
                수정
              </Button>
              <Button
                variant="destructive"
                onClick={() => setDeleting(true)}
              >
                <Trash2 className="mr-2 size-4" />
                삭제
              </Button>
            </div>
          )}
        </div>

        {/* 대표 미디어 */}
        <div className="mb-8 lg:w-8/10">
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
            {mediaUrl && agent.site_media_type === "image" ? (
              <img
                src={mediaUrl}
                alt={agent.name}
                className="h-full w-full object-cover"
              />
            ) : mediaUrl && agent.site_media_type === "video" ? (
              <video
                src={mediaUrl}
                className="h-full w-full object-cover"
                autoPlay
                loop
                playsInline
                muted
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Bot className="size-12 text-muted-foreground" />
              </div>
            )}
          </div>
        </div>

        {/* 에이전트 확인하기 버튼 */}
        {agent.site_url && (
          <div className="mb-8">
            <Button
              onClick={() => {
                if (agent.site_url) {
                  window.open(agent.site_url, "_blank");
                }
              }}
              className="!text-12-medium w-full sm:w-auto bg-foreground text-background hover:bg-foreground/90"
            >
              <ExternalLink className="mr-2 size-4" />
              에이전트 확인하기
            </Button>
          </div>
        )}

        {/* 구체적인 설명 */}
        <div className="mb-8 md:w-7/10">
          <h2 className="mb-3 text-16-semibold">이게 뭔가요?</h2>
          <div className="">
            <p className="whitespace-pre-wrap text-muted-foreground text-14-regular">
              {agent.detailed_description}
            </p>
          </div>
        </div>

        {/* 특징 리스트 */}
        <div className="mb-8 md:w-7/10">
          <h2 className="mb-3 text-16-semibold">포함 사항</h2>
          <div className="rounded-lg ">
            <ul className="space-y-3">
              {agent.features.map((feature, index) => (
                <li key={index} className="flex items-start gap-3">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span className="text-muted-foreground text-12-regular">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>에이전트 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 이 에이전트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
              disabled={deleteAgent.isPending}
            >
              {deleteAgent.isPending ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 수정 모달 */}
      {isOwner && (
        <AgentFormDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          agentId={agentId}
        />
      )}
    </>
  );
}
