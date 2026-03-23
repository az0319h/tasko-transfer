import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AgentForm } from "@/components/agent/agent-form";
import { useCreateAgent, useUpdateAgent } from "@/hooks/mutations/use-agent";
import { useAgent } from "@/hooks/queries/use-agents";
import { useQueryClient } from "@tanstack/react-query";
import DefaultSpinner from "@/components/common/default-spinner";
import { Button } from "@/components/ui/button";
import type { AgentFormData } from "@/components/agent/agent-form";

type AgentFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId?: string | null;
};

export function AgentFormDialog({
  open,
  onOpenChange,
  agentId,
}: AgentFormDialogProps) {
  const isEditMode = !!agentId;
  const { data: agent, isLoading: isLoadingAgent } = useAgent(agentId || undefined);
  const createAgentMutation = useCreateAgent();
  const updateAgentMutation = useUpdateAgent();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 수정 모드에서 에이전트 데이터 로딩
  useEffect(() => {
    if (isEditMode && !agentId) {
      onOpenChange(false);
    }
  }, [isEditMode, agentId, onOpenChange]);

  const handleSubmit = async (data: AgentFormData) => {
    setIsSubmitting(true);

    try {
      if (isEditMode && agentId) {
        // 수정 모드 - 미디어 파일은 선택사항
        // 파일이 있으면 File 객체이고, 없으면 null이므로 명시적으로 확인
        const updateData: {
          name: string;
          description: string;
          detailed_description: string;
          features: string[];
          site_url: string;
          site_media_file?: File;
          site_media_type?: "image" | "video";
        } = {
          name: data.name,
          description: data.description,
          detailed_description: data.detailed_description,
          features: data.features,
          site_url: data.site_url,
        };
        
        // 새 미디어 파일이 선택된 경우에만 추가
        if (data.site_media_file instanceof File && data.site_media_type) {
          updateData.site_media_file = data.site_media_file;
          updateData.site_media_type = data.site_media_type;
        }
        
        await updateAgentMutation.mutateAsync({
          agentId,
          data: updateData,
        });
      } else {
        // 생성 모드 - 모든 필드 필수
        await createAgentMutation.mutateAsync({
          name: data.name,
          description: data.description,
          detailed_description: data.detailed_description,
          features: data.features,
          site_url: data.site_url,
          site_media_file: data.site_media_file!,
          site_media_type: data.site_media_type!,
        });
      }

      // 쿼리 무효화하여 목록 새로고침
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      setIsSubmitting(false);
      onOpenChange(false);
    } catch (error) {
      setIsSubmitting(false);
      // 에러는 mutation에서 toast로 처리됨
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  // 수정 모드에서 데이터 로딩 중
  if (isEditMode && isLoadingAgent) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="!max-w-200 w-9/10 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center py-8">
            <DefaultSpinner />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // 수정 모드에서 에이전트를 찾을 수 없는 경우
  if (isEditMode && !agent && !isLoadingAgent) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="!max-w-200 w-9/10 max-h-[90vh] overflow-y-auto">
          <div className="py-8 text-center">
            <p className="text-muted-foreground">에이전트를 찾을 수 없습니다.</p>
            <Button onClick={() => onOpenChange(false)} className="mt-4">
              닫기
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-200 w-9/10 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "에이전트 수정" : "에이전트 생성"}</DialogTitle>
          <DialogDescription>
            {isEditMode ? "에이전트 정보를 수정하세요" : "새로운 에이전트를 생성하세요"}
          </DialogDescription>
        </DialogHeader>
        <AgentForm
          initialData={agent}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={createAgentMutation.isPending || updateAgentMutation.isPending || isSubmitting}
        />
      </DialogContent>
    </Dialog>
  );
}
