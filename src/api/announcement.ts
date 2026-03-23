import supabase from "@/lib/supabase";
import { checkAdminPermission } from "@/api/admin";
import { uploadTaskFile, deleteTaskFile } from "@/api/storage";

/**
 * 공지사항 타입 정의
 * TODO: database.type.ts 재생성 후 Tables<"announcements"> 사용
 */
export type Announcement = {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  created_by: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AnnouncementInsert = Omit<Announcement, "id" | "created_at" | "updated_at">;
export type AnnouncementUpdate = Partial<Omit<Announcement, "id" | "created_by" | "created_at" | "updated_at">>;

/**
 * 공지사항 첨부파일 타입 정의
 */
export type AnnouncementAttachment = {
  id: string;
  announcement_id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  file_type: string | null;
  created_at: string;
};

/**
 * 공지사항 with 첨부파일 및 작성자 정보
 */
export type AnnouncementWithDetails = Announcement & {
  attachments: AnnouncementAttachment[];
  created_by_profile: {
    id: string;
    full_name: string | null;
    email: string;
  } | null;
};

/**
 * 활성 공지사항 조회 (일반 사용자용)
 * - is_active = true
 * - expires_at이 NULL이거나 미래인 것만
 * - 사용자가 "다시 보지 않음"으로 표시한 것은 제외
 * - 최신순 정렬
 */
export async function getActiveAnnouncements(): Promise<AnnouncementWithDetails[]> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("인증이 필요합니다.");
  }

  const userId = session.session.user.id;

  // 사용자가 "다시 보지 않음"으로 표시한 공지사항 ID 조회
  const { data: dismissedData } = await supabase
    .from("announcement_dismissals")
    .select("announcement_id")
    .eq("user_id", userId);

  const dismissedIds = dismissedData?.map((d) => d.announcement_id) || [];

  // 활성 공지사항 조회
  let query = supabase
    .from("announcements")
    .select(`
      *,
      attachments:announcement_attachments(*)
    `)
    .eq("is_active", true)
    .or("expires_at.is.null,expires_at.gt.now()")
    .order("created_at", { ascending: false });

  // "다시 보지 않음"으로 표시한 공지사항 제외
  if (dismissedIds.length > 0) {
    query = query.not("id", "in", `(${dismissedIds.join(",")})`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`공지사항 조회 실패: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  // 작성자 프로필 정보 조회
  const creatorIds = [...new Set(data.map((a) => a.created_by))];
  const { data: creators } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", creatorIds);

  const creatorMap = new Map(
    (creators || []).map((c) => [c.id, { id: c.id, full_name: c.full_name, email: c.email }])
  );

  // 작성자 정보 추가
  return data.map((announcement) => ({
    ...announcement,
    created_by_profile: creatorMap.get(announcement.created_by) || null,
  })) as AnnouncementWithDetails[];
}

/**
 * 공지사항 상세 조회 (관리자용, 모든 공지사항 조회 가능)
 */
export async function getAnnouncementById(id: string): Promise<AnnouncementWithDetails | null> {
  const { data, error } = await supabase
    .from("announcements")
    .select(`
      *,
      attachments:announcement_attachments(*)
    `)
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`공지사항 조회 실패: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  // 작성자 프로필 정보 조회
  const { data: creator } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", data.created_by)
    .single();

  return {
    ...data,
    created_by_profile: creator
      ? { id: creator.id, full_name: creator.full_name, email: creator.email }
      : null,
  } as AnnouncementWithDetails;
}

/**
 * 공지사항 목록 조회 (관리자용)
 * 모든 데이터를 한 번에 가져옴 (클라이언트 사이드 필터링/페이지네이션용)
 */
export async function getAnnouncements(): Promise<AnnouncementWithDetails[]> {
  // 관리자 권한 확인
  const isAdmin = await checkAdminPermission();
  if (!isAdmin) {
    throw new Error("관리자 권한이 필요합니다.");
  }

  // 모든 데이터 조회
  const { data, error } = await supabase
    .from("announcements")
    .select(`
      *,
      attachments:announcement_attachments(*)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`공지사항 목록 조회 실패: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  // 작성자 프로필 정보 조회
  const creatorIds = [...new Set(data.map((a) => a.created_by))];
  const { data: creators } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", creatorIds);

  const creatorMap = new Map(
    (creators || []).map((c) => [c.id, { id: c.id, full_name: c.full_name, email: c.email }])
  );

  // 작성자 정보 추가
  return data.map((announcement) => ({
    ...announcement,
    created_by_profile: creatorMap.get(announcement.created_by) || null,
  })) as AnnouncementWithDetails[];
}

/**
 * 공지사항 생성 (관리자만 가능)
 */
export async function createAnnouncement(
  announcement: Omit<AnnouncementInsert, "created_by">,
  attachments?: Array<{ file_name: string; file_url: string; file_size: number; file_type: string }>
): Promise<AnnouncementWithDetails> {
  // 관리자 권한 확인
  const isAdmin = await checkAdminPermission();
  if (!isAdmin) {
    throw new Error("관리자 권한이 필요합니다.");
  }

  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("인증이 필요합니다.");
  }

  const currentUserId = session.session.user.id;

  // 공지사항 생성
  const { data: announcementData, error: announcementError } = await supabase
    .from("announcements")
    .insert({
      ...announcement,
      created_by: currentUserId,
    })
    .select()
    .single();

  if (announcementError) {
    throw new Error(`공지사항 생성 실패: ${announcementError.message}`);
  }

  // 첨부파일 추가
  if (attachments && attachments.length > 0) {
    const { error: attachmentsError } = await supabase
      .from("announcement_attachments")
      .insert(
        attachments.map((att) => ({
          announcement_id: announcementData.id,
          file_name: att.file_name,
          file_url: att.file_url,
          file_size: att.file_size,
          file_type: att.file_type,
        }))
      );

    if (attachmentsError) {
      // 공지사항은 생성되었지만 첨부파일 추가 실패
      console.error("첨부파일 추가 실패:", attachmentsError);
      // 공지사항은 이미 생성되었으므로 에러를 던지지 않고 계속 진행
    }
  }

  // 생성된 공지사항 다시 조회 (첨부파일 포함)
  const createdAnnouncement = await getAnnouncementById(announcementData.id);
  if (!createdAnnouncement) {
    throw new Error("공지사항 생성 후 조회에 실패했습니다.");
  }

  return createdAnnouncement;
}

/**
 * 공지사항 수정 (관리자만 가능)
 */
export async function updateAnnouncement(
  id: string,
  updates: AnnouncementUpdate,
  attachments?: Array<{ file_name: string; file_url: string; file_size: number; file_type: string }>,
  deletedAttachmentIds?: string[]
): Promise<AnnouncementWithDetails> {
  // 관리자 권한 확인
  const isAdmin = await checkAdminPermission();
  if (!isAdmin) {
    throw new Error("관리자 권한이 필요합니다.");
  }

  // 공지사항 수정
  const { error: updateError } = await supabase
    .from("announcements")
    .update(updates)
    .eq("id", id);

  if (updateError) {
    throw new Error(`공지사항 수정 실패: ${updateError.message}`);
  }

  // 삭제된 첨부파일 처리
  if (deletedAttachmentIds && deletedAttachmentIds.length > 0) {
    // 각 삭제된 첨부파일을 삭제
    for (const attachmentId of deletedAttachmentIds) {
      try {
        await deleteAnnouncementAttachment(attachmentId);
      } catch (error) {
        console.error(`첨부파일 삭제 실패 (ID: ${attachmentId}):`, error);
        // 개별 파일 삭제 실패해도 계속 진행
      }
    }
  }

  // 첨부파일 추가 (기존 첨부파일은 유지, 새로 추가만)
  if (attachments && attachments.length > 0) {
    const { error: attachmentsError } = await supabase
      .from("announcement_attachments")
      .insert(
        attachments.map((att) => ({
          announcement_id: id,
          file_name: att.file_name,
          file_url: att.file_url,
          file_size: att.file_size,
          file_type: att.file_type,
        }))
      );

    if (attachmentsError) {
      console.error("첨부파일 추가 실패:", attachmentsError);
    }
  }

  // 수정된 공지사항 다시 조회
  const updatedAnnouncement = await getAnnouncementById(id);
  if (!updatedAnnouncement) {
    throw new Error("공지사항 수정 후 조회에 실패했습니다.");
  }

  return updatedAnnouncement;
}

/**
 * 공지사항 삭제 (관리자만 가능)
 */
export async function deleteAnnouncement(id: string): Promise<void> {
  // 관리자 권한 확인
  const isAdmin = await checkAdminPermission();
  if (!isAdmin) {
    throw new Error("관리자 권한이 필요합니다.");
  }

  // 첨부파일 먼저 조회 (삭제 전에 파일 URL 저장)
  const { data: attachments } = await supabase
    .from("announcement_attachments")
    .select("file_url")
    .eq("announcement_id", id);

  // 공지사항 삭제 (CASCADE로 첨부파일도 자동 삭제됨)
  const { error } = await supabase.from("announcements").delete().eq("id", id);

  if (error) {
    throw new Error(`공지사항 삭제 실패: ${error.message}`);
  }

  // Storage에서 파일 삭제
  if (attachments) {
    for (const attachment of attachments) {
      try {
        await deleteAnnouncementFile(attachment.file_url);
      } catch (err) {
        console.error(`파일 삭제 실패 (${attachment.file_url}):`, err);
        // 파일 삭제 실패해도 공지사항 삭제는 완료되었으므로 계속 진행
      }
    }
  }
}

/**
 * 공지사항 활성화 토글 (관리자만 가능)
 */
export async function toggleAnnouncementActive(id: string): Promise<AnnouncementWithDetails> {
  // 관리자 권한 확인
  const isAdmin = await checkAdminPermission();
  if (!isAdmin) {
    throw new Error("관리자 권한이 필요합니다.");
  }

  // 현재 공지사항 조회
  const current = await getAnnouncementById(id);
  if (!current) {
    throw new Error("공지사항을 찾을 수 없습니다.");
  }

  // 활성화 상태 토글
  const { error } = await supabase
    .from("announcements")
    .update({ is_active: !current.is_active })
    .eq("id", id);

  if (error) {
    throw new Error(`공지사항 활성화 토글 실패: ${error.message}`);
  }

  // 토글된 공지사항 다시 조회
  const toggledAnnouncement = await getAnnouncementById(id);
  if (!toggledAnnouncement) {
    throw new Error("공지사항 활성화 토글 후 조회에 실패했습니다.");
  }

  return toggledAnnouncement;
}

/**
 * 공지사항 "다시 보지 않음" 처리
 */
export async function dismissAnnouncement(announcementId: string): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("인증이 필요합니다.");
  }

  const userId = session.session.user.id;

  const { error } = await supabase
    .from("announcement_dismissals")
    .insert({
      announcement_id: announcementId,
      user_id: userId,
    });

  if (error) {
    // 이미 존재하는 경우 (UNIQUE 제약조건) 에러 무시
    if (error.code === "23505") {
      return;
    }
    throw new Error(`"다시 보지 않음" 처리 실패: ${error.message}`);
  }
}

/**
 * 공지사항 파일 업로드 (announcements 버킷)
 */
export async function uploadAnnouncementFile(
  file: File,
  announcementId: string
): Promise<{ url: string; fileName: string; fileType: string; fileSize: number }> {
  // 관리자 권한 확인
  const isAdmin = await checkAdminPermission();
  if (!isAdmin) {
    throw new Error("관리자 권한이 필요합니다.");
  }

  // 파일 확장자 추출
  const fileExt = file.name.split(".").pop();
  const timestamp = Date.now();
  
  // task 파일 업로드와 동일한 방식: 원본 파일명을 경로에 포함시키지 않고 타임스탬프 기반 파일명만 사용
  // 이렇게 하면 한국어 파일명 문제가 완전히 해결됨
  const fileName = `${announcementId}/${timestamp}.${fileExt}`;
  const filePath = fileName;

  // 파일 업로드
  const { data, error } = await supabase.storage
    .from("announcements")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    throw new Error(`파일 업로드 실패: ${error.message}`);
  }

  // 공개 URL 반환
  const {
    data: { publicUrl },
  } = supabase.storage.from("announcements").getPublicUrl(data.path);

  return {
    url: publicUrl,
    fileName: file.name,
    fileType: file.type || "application/octet-stream",
    fileSize: file.size,
  };
}

/**
 * 공지사항 이미지 업로드 (announcements 버킷)
 */
export async function uploadAnnouncementImage(
  file: File,
  announcementId: string
): Promise<string> {
  // 관리자 권한 확인
  const isAdmin = await checkAdminPermission();
  if (!isAdmin) {
    throw new Error("관리자 권한이 필요합니다.");
  }

  // 파일 확장자 추출
  const fileExt = file.name.split(".").pop();
  const timestamp = Date.now();
  const fileName = `${announcementId}/image-${timestamp}.${fileExt}`;
  const filePath = fileName;

  // 이미지 업로드
  const { data, error } = await supabase.storage
    .from("announcements")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    throw new Error(`이미지 업로드 실패: ${error.message}`);
  }

  // 공개 URL 반환
  const {
    data: { publicUrl },
  } = supabase.storage.from("announcements").getPublicUrl(data.path);

  return publicUrl;
}

/**
 * 공지사항 파일 삭제 (announcements 버킷)
 */
export async function deleteAnnouncementFile(fileUrl: string): Promise<void> {
  // 관리자 권한 확인
  const isAdmin = await checkAdminPermission();
  if (!isAdmin) {
    throw new Error("관리자 권한이 필요합니다.");
  }

  try {
    const urlObj = new URL(fileUrl);
    const pathParts = urlObj.pathname.split("/");
    const bucketIndex = pathParts.findIndex((part) => part === "announcements");

    if (bucketIndex === -1) {
      throw new Error("Invalid file URL");
    }

    const path = pathParts.slice(bucketIndex + 1).join("/");
    const { error } = await supabase.storage.from("announcements").remove([path]);

    if (error) throw error;
  } catch (err: unknown) {
    // URL 파싱 실패 시 기존 방식으로 시도
    const urlParts = fileUrl.split("/");
    const pathIndex = urlParts.findIndex((part) => part === "announcements");

    if (pathIndex === -1) {
      throw new Error(`파일 삭제 실패: Invalid file URL`);
    }

    const path = urlParts.slice(pathIndex + 1).join("/");
    const { error: storageError } = await supabase.storage.from("announcements").remove([path]);

    if (storageError) {
      throw new Error(`파일 삭제 실패: ${storageError.message}`);
    }
  }
}

/**
 * 공지사항 첨부파일 삭제 (DB 레코드만 삭제, Storage 파일은 별도 삭제 필요)
 */
export async function deleteAnnouncementAttachment(attachmentId: string): Promise<void> {
  // 관리자 권한 확인
  const isAdmin = await checkAdminPermission();
  if (!isAdmin) {
    throw new Error("관리자 권한이 필요합니다.");
  }

  // 첨부파일 정보 조회 (파일 URL 저장)
  const { data: attachment } = await supabase
    .from("announcement_attachments")
    .select("file_url")
    .eq("id", attachmentId)
    .single();

  if (!attachment) {
    throw new Error("첨부파일을 찾을 수 없습니다.");
  }

  // DB에서 첨부파일 레코드 삭제
  const { error } = await supabase.from("announcement_attachments").delete().eq("id", attachmentId);

  if (error) {
    throw new Error(`첨부파일 삭제 실패: ${error.message}`);
  }

  // Storage에서 파일 삭제
  try {
    await deleteAnnouncementFile(attachment.file_url);
  } catch (err) {
    console.error(`Storage 파일 삭제 실패 (${attachment.file_url}):`, err);
    // Storage 파일 삭제 실패해도 DB 레코드는 삭제되었으므로 계속 진행
  }
}
