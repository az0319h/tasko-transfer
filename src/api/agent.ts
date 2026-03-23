import supabase from "@/lib/supabase";
import { uploadAgentSiteMedia, deleteAgentSiteMedia } from "@/api/storage";
import type { Agent, AgentWithMedia, CreateAgentInput, UpdateAgentInput } from "@/types/domain/agent";

/**
 * 에이전트 목록 조회
 * 모든 인증된 사용자가 모든 에이전트를 조회할 수 있습니다.
 * @returns 에이전트 목록
 */
export async function getAgents(): Promise<Agent[]> {

  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`에이전트 목록 조회 실패: ${error.message}`);
  }

  // features를 JSONB에서 string[]로 변환
  return (data || []).map((agent) => ({
    ...agent,
    features: (agent.features as string[]) || [],
  })) as Agent[];
}

/**
 * 에이전트 상세 조회
 * @param agentId 에이전트 ID
 * @returns 에이전트 상세 정보 (미디어 URL 포함)
 */
export async function getAgentById(agentId: string): Promise<AgentWithMedia> {

  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new Error("에이전트를 찾을 수 없습니다.");
    }
    throw new Error(`에이전트 조회 실패: ${error.message}`);
  }

  if (!data) {
    throw new Error("에이전트를 찾을 수 없습니다.");
  }

  // features를 JSONB에서 string[]로 변환
  const agent: Agent = {
    ...data,
    features: (data.features as string[]) || [],
    site_media_type: (data.site_media_type as 'image' | 'video' | null) || null,
    created_at: data.created_at || new Date().toISOString(),
    updated_at: data.updated_at || new Date().toISOString(),
  };

  // 미디어 공개 URL 생성
  let media_public_url: string | null = null;
  if (agent.site_media_url) {
    const {
      data: { publicUrl },
    } = supabase.storage.from("agents").getPublicUrl(agent.site_media_url);
    media_public_url = publicUrl;
  }

  return {
    ...agent,
    media_public_url,
  };
}

/**
 * 에이전트 생성
 * 모든 인증된 사용자가 에이전트를 생성할 수 있습니다.
 * @param input 에이전트 생성 데이터
 * @returns 생성된 에이전트
 */
export async function createAgent(input: CreateAgentInput): Promise<Agent> {

  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("인증이 필요합니다.");
  }

  const userId = session.session.user.id;

  // 미디어 파일이 있으면 먼저 업로드
  let site_media_url: string | null = null;
  let site_media_type: 'image' | 'video' | null = null;

  if (input.site_media_file && input.site_media_type) {
    // 임시 agentId 생성 (업로드 후 실제 ID로 업데이트)
    const tempAgentId = crypto.randomUUID();
    site_media_url = await uploadAgentSiteMedia(
      input.site_media_file,
      tempAgentId,
      userId,
      input.site_media_type
    );
    site_media_type = input.site_media_type;
  }

  // 에이전트 생성
  const { data, error } = await supabase
    .from("agents")
    .insert({
      name: input.name,
      description: input.description,
      detailed_description: input.detailed_description || null,
      features: input.features || [],
      site_media_url,
      site_media_type,
      site_url: input.site_url || null,
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    // 업로드한 미디어가 있으면 삭제
    if (site_media_url) {
      try {
        await deleteAgentSiteMedia(site_media_url);
      } catch (err) {
        console.error("미디어 삭제 실패:", err);
      }
    }
    throw new Error(`에이전트 생성 실패: ${error.message}`);
  }

  // features를 JSONB에서 string[]로 변환
  return {
    ...data,
    features: (data.features as string[]) || [],
  } as Agent;
}

/**
 * 에이전트 수정
 * 자신이 생성한 에이전트만 수정할 수 있습니다.
 * @param agentId 에이전트 ID
 * @param input 에이전트 수정 데이터
 * @returns 수정된 에이전트
 */
export async function updateAgent(
  agentId: string,
  input: UpdateAgentInput
): Promise<Agent> {

  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("인증이 필요합니다.");
  }

  const userId = session.session.user.id;

  // 기존 에이전트 조회 (소유자 확인 및 기존 미디어 URL 가져오기)
  const { data: existingAgent, error: fetchError } = await supabase
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .single();

  if (fetchError || !existingAgent) {
    throw new Error("에이전트를 찾을 수 없습니다.");
  }

  // 소유자 확인
  if (existingAgent.created_by !== userId) {
    throw new Error("자신이 생성한 에이전트만 수정할 수 있습니다.");
  }

  // 미디어 파일이 있으면 업로드
  let site_media_url: string | null = existingAgent.site_media_url;
  let site_media_type: 'image' | 'video' | null = (existingAgent.site_media_type as 'image' | 'video' | null) || null;

  if (input.site_media_file && input.site_media_type) {
    // 기존 미디어가 있으면 삭제
    if (site_media_url) {
      try {
        await deleteAgentSiteMedia(site_media_url);
      } catch (err) {
        console.error("기존 미디어 삭제 실패:", err);
      }
    }

    // 새 미디어 업로드
    site_media_url = await uploadAgentSiteMedia(
      input.site_media_file,
      agentId,
      userId,
      input.site_media_type
    );
    site_media_type = input.site_media_type;
  }

  // 에이전트 수정
  const updateData: Partial<Agent> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.detailed_description !== undefined) {
    updateData.detailed_description = input.detailed_description || null;
  }
  if (input.features !== undefined) updateData.features = input.features;
  if (input.site_url !== undefined) updateData.site_url = input.site_url || null;
  if (site_media_url !== undefined) updateData.site_media_url = site_media_url;
  if (site_media_type !== undefined) updateData.site_media_type = site_media_type;

  const { data, error } = await supabase
    .from("agents")
    .update(updateData)
    .eq("id", agentId)
    .select()
    .single();

  if (error) {
    throw new Error(`에이전트 수정 실패: ${error.message}`);
  }

  // features를 JSONB에서 string[]로 변환
  return {
    ...data,
    features: (data.features as string[]) || [],
  } as Agent;
}

/**
 * 에이전트 삭제
 * 자신이 생성한 에이전트만 삭제할 수 있습니다.
 * @param agentId 에이전트 ID
 */
export async function deleteAgent(agentId: string): Promise<void> {

  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("인증이 필요합니다.");
  }

  const userId = session.session.user.id;

  // 기존 에이전트 조회 (소유자 확인 및 미디어 URL 가져오기)
  const { data: existingAgent, error: fetchError } = await supabase
    .from("agents")
    .select("site_media_url, created_by")
    .eq("id", agentId)
    .single();

  if (fetchError || !existingAgent) {
    throw new Error("에이전트를 찾을 수 없습니다.");
  }

  // 소유자 확인
  if (existingAgent.created_by !== userId) {
    throw new Error("자신이 생성한 에이전트만 삭제할 수 있습니다.");
  }

  // 미디어가 있으면 삭제
  if (existingAgent.site_media_url) {
    try {
      await deleteAgentSiteMedia(existingAgent.site_media_url);
    } catch (err) {
      console.error("미디어 삭제 실패:", err);
      // 미디어 삭제 실패해도 에이전트는 삭제 진행
    }
  }

  // 에이전트 삭제
  const { error } = await supabase.from("agents").delete().eq("id", agentId);

  if (error) {
    throw new Error(`에이전트 삭제 실패: ${error.message}`);
  }
}
