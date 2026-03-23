import { useSession } from "@/store/session";
import { Navigate, Outlet } from "react-router";
import { useCurrentProfile, useCreateProfileAuto } from "@/hooks";
import DefaultSpinner from "../common/default-spinner";
import { useRef, useEffect, useState, useMemo } from "react";
import { useSignOut } from "@/hooks/mutations/use-sign-out";
import { useSetSession } from "@/store/session";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function MemberOnlyLayout() {
  const session = useSession();
  const { data: profile, isLoading, isError, error } = useCurrentProfile();
  const queryClient = useQueryClient();
  const hasCreatedProfile = useRef(false);
  const isSigningOut = useRef(false);
  const hasShownInactiveToast = useRef<string | null>(null); // 프로필 ID를 추적
  const isProcessingInactive = useRef(false); // 비활성화 처리 중 플래그
  const processedSessionId = useRef<string | null>(null); // 처리한 세션 ID 추적
  const [profileCheckAttempts, setProfileCheckAttempts] = useState(0);
  const setSession = useSetSession();

  const { mutate: signOut } = useSignOut({
    onSuccess: () => {
      setSession(null);
      isSigningOut.current = false;
      hasShownInactiveToast.current = null; // 로그아웃 시 리셋
      isProcessingInactive.current = false; // 처리 완료
      processedSessionId.current = null; // 세션 ID 리셋
    },
    onError: () => {
      isSigningOut.current = false;
      isProcessingInactive.current = false; // 에러 시에도 리셋
    },
  });

  const { mutate: createProfileAuto } = useCreateProfileAuto({
    onSuccess: () => {
      // 프로필 생성 성공 시 쿼리 무효화하여 다시 조회
      queryClient.invalidateQueries({ queryKey: ["profile", "current"] });
      hasCreatedProfile.current = true;
    },
    onError: (error) => {
      console.error("프로필 자동 생성 실패:", error);
      hasCreatedProfile.current = false; // 실패 시 다시 시도 가능하도록
    },
  });

  // 프로필이 없고 에러가 없는 경우 (프로필이 정말 없는 경우) 자동 생성
  useEffect(() => {
    if (
      !isLoading &&
      !profile &&
      !isError &&
      session &&
      !hasCreatedProfile.current &&
      profileCheckAttempts < 3 // 최대 3번만 시도
    ) {
      hasCreatedProfile.current = true;
      setProfileCheckAttempts((prev) => prev + 1);
      createProfileAuto();
    }
  }, [profile, isLoading, isError, session, createProfileAuto, profileCheckAttempts]);

  // 프로필 조회 에러 발생 시 재시도 (RLS 정책 문제 등)
  useEffect(() => {
    if (isError && session && profileCheckAttempts < 3 && !hasCreatedProfile.current) {
      // 에러 발생 시 잠시 후 재시도
      const timer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["profile", "current"] });
        setProfileCheckAttempts((prev) => prev + 1);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [isError, session, profileCheckAttempts, queryClient]);

  // 프로필의 실제 값만 추적 (객체 참조 변경 방지)
  const profileId = useMemo(() => profile?.id ?? null, [profile?.id]);
  const profileIsActive = useMemo(() => profile?.is_active, [profile?.is_active]);
  const sessionId = useMemo(() => session?.user?.id ?? null, [session?.user?.id]);

  // 비활성화된 사용자 체크 (프로필이 성공적으로 로드되었을 때만 한 번)
  useEffect(() => {
    // 세션이 없으면 실행하지 않음
    if (!sessionId) return;

    // 로딩 중이거나 에러가 있으면 실행하지 않음
    if (isLoading || isError) return;

    // 프로필 ID가 없으면 실행하지 않음
    if (!profileId) return;

    // 활성화된 사용자는 처리하지 않음
    if (profileIsActive !== false) return;

    // 이미 처리한 세션이거나 프로필이면 실행하지 않음
    if (processedSessionId.current === sessionId || hasShownInactiveToast.current === profileId) {
      return;
    }

    // 이미 처리 중이면 실행하지 않음
    if (isProcessingInactive.current || isSigningOut.current) {
      return;
    }

    // 처리 중 플래그 설정 (중복 실행 방지) - 즉시 설정
    isProcessingInactive.current = true;
    processedSessionId.current = sessionId;
    hasShownInactiveToast.current = profileId;
    isSigningOut.current = true;

    // 비활성화된 사용자는 로그아웃 처리
    signOut();
  }, [isLoading, isError, profileId, profileIsActive, sessionId, signOut]);

  if (!session) return <Navigate to={"/sign-in"} replace={true} />;

  // 프로필 로딩 중이거나 재시도 중일 때는 스피너 표시
  if (isLoading || (isError && profileCheckAttempts < 3)) {
    return <DefaultSpinner />;
  }

  // 프로필이 있고 비활성화된 경우 리다이렉트
  if (!isError && profile && profile.is_active === false) {
    return <Navigate to={"/sign-in"} replace={true} />;
  }

  // 프로필 조회가 계속 실패하지만 세션이 있는 경우
  // (프로필이 없거나 RLS 정책 문제일 수 있음)
  // 일단 진행 허용 (프로필 자동 생성 시도 중)
  return <Outlet />;
}
