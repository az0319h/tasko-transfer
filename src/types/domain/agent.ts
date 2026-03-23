/**
 * 에이전트 도메인 타입 정의
 */

export interface Agent {
  id: string;
  name: string;
  description: string; // 간략한 설명 (목록 페이지용)
  detailed_description: string | null; // 구체적인 설명 (상세 페이지용)
  features: string[]; // 에이전트 특징 리스트
  site_media_url: string | null; // 대표 미디어 URL (이미지 또는 비디오, Storage 버킷 경로)
  site_media_type: 'image' | 'video' | null; // 대표 미디어 타입
  site_url: string | null; // 에이전트 사이트 URL (에이전트 확인하기 버튼용)
  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * 에이전트 생성 입력 타입
 */
export interface CreateAgentInput {
  name: string;
  description: string; // 간략한 설명
  detailed_description?: string; // 구체적인 설명
  features?: string[]; // 특징 리스트
  site_url?: string; // 에이전트 사이트 URL
  site_media_file?: File; // 대표 미디어 파일 (이미지 또는 비디오)
  site_media_type?: 'image' | 'video'; // 대표 미디어 타입
}

/**
 * 에이전트 수정 입력 타입
 */
export interface UpdateAgentInput {
  name?: string;
  description?: string; // 간략한 설명
  detailed_description?: string; // 구체적인 설명
  features?: string[]; // 특징 리스트
  site_url?: string; // 에이전트 사이트 URL
  site_media_file?: File; // 대표 미디어 파일 (이미지 또는 비디오)
  site_media_type?: 'image' | 'video'; // 대표 미디어 타입
}

/**
 * 에이전트 with 미디어 정보
 */
export interface AgentWithMedia extends Agent {
  media_public_url?: string | null; // 공개 URL (이미지/비디오)
}
