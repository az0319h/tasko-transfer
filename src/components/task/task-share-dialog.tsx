import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Mail} from 'lucide-react';
import kakaoLogo from '@/assets/kakao.png';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { Tables } from "@/database.type";


// 카카오톡 SDK 타입 선언
declare global {
  interface Window {
    Kakao: {
      init: (appKey: string) => void;
      isInitialized: () => boolean;
      Share: {
        sendDefault: (options: {
          objectType: string;
          text?: string;
          content?: {
            title: string;
            description: string;
            imageUrl?: string;
            link: {
              mobileWebUrl: string;
              webUrl: string;
            };
          };
          link?: {
            mobileWebUrl: string;
            webUrl: string;
          };
          buttonTitle?: string;
          buttons?: Array<{
            title: string;
            link: {
              mobileWebUrl: string;
              webUrl: string;
            };
          }>;
        }) => void;
        sendCustom: (options: {
          templateId?: number;
          templateArgs?: Record<string, string>;
        }) => void;
        createCustomButton: (options: {
          container: string;
          templateId: number;
          templateArgs?: Record<string, string>;
        }) => void;
        createDefaultButton: (options: {
          container: string;
          objectType: string;
          text?: string;
          content?: {
            title: string;
            description: string;
            imageUrl?: string;
            link: {
              mobileWebUrl: string;
              webUrl: string;
            };
          };
          link?: {
            mobileWebUrl: string;
            webUrl: string;
          };
          buttonTitle?: string;
          buttons?: Array<{
            title: string;
            link: {
              mobileWebUrl: string;
              webUrl: string;
            };
          }>;
        }) => void;
      };
    };
  }
}

type Task = Tables<"tasks">;

interface TaskShareDialogProps {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskShareDialog({
  task,
  open,
  onOpenChange,
}: TaskShareDialogProps) {
  const [shareLink, setShareLink] = useState("");

  // 공유 링크 생성 (절대 경로, HTTPS 보장)
  useEffect(() => {
    if (task?.id) {
      // 프로덕션 환경에서는 VITE_FRONTEND_URL 사용, 없으면 window.location.origin 사용
      const frontendUrl = import.meta.env.VITE_FRONTEND_URL || window.location.origin;
      
      // HTTPS로 변환 (프로덕션 환경에서)
      let baseUrl = frontendUrl;
      // HTTP를 HTTPS로 변환 (localhost 제외)
      if (baseUrl.startsWith('http://') && !baseUrl.includes('localhost') && !baseUrl.includes('127.0.0.1')) {
        baseUrl = baseUrl.replace('http://', 'https://');
      }
      // 이미 HTTPS인 경우 그대로 사용
      
      const link = `${baseUrl}/tasks/${task.id}`;
      setShareLink(link);
      
      // localhost 경고 (카카오톡은 localhost에 접근할 수 없음)
      if (link.includes('localhost') || link.includes('127.0.0.1')) {
        console.warn('⚠️ 카카오톡 공유 경고: localhost 도메인은 카카오톡에서 접근할 수 없습니다.');
        console.warn('프로덕션 환경에서는 VITE_FRONTEND_URL을 실제 도메인(예: https://tasko.io.kr)으로 설정해야 합니다.');
      }
    }
  }, [task?.id]);

  // 카카오톡 SDK 초기화
  useEffect(() => {
    const kakaoAppKey = import.meta.env.VITE_KAKAO_APP_KEY;
    if (kakaoAppKey && window.Kakao && !window.Kakao.isInitialized()) {
      window.Kakao.init(kakaoAppKey);
    }
  }, []);

  // 링크 복사 기능
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      toast.success("링크가 복사되었습니다");
    } catch (error) {
      toast.error("링크 복사에 실패했습니다");
    }
  };

  // 이메일 공유 기능
  const handleEmailShare = () => {
    // 공유 링크 검증
    if (!shareLink || shareLink.trim() === "") {
      toast.error("공유 링크가 아직 생성되지 않았습니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    // 링크가 유효한 URL인지 확인
    if (!shareLink.startsWith('http://') && !shareLink.startsWith('https://')) {
      toast.error("공유 링크가 올바르지 않습니다.");
      return;
    }

    try {
      const subject = encodeURIComponent("업무 공유의 건");
      // URL을 인코딩하지 않고 그대로 넣어서 이메일 클라이언트가 자동으로 링크로 인식하도록 함
      // URL 앞뒤에 공백과 줄바꿈을 넣어서 명확하게 구분
      const bodyText = `아래와 같이 업무를 공유드립니다:

${shareLink}

위 링크를 클릭하여 Task를 확인하실 수 있습니다.
만약 링크가 클릭되지 않는다면, 위 주소를 복사하여 브라우저 주소창에 붙여넣어주세요.`;
      const body = encodeURIComponent(bodyText);
      
      // mailto: URL 생성
      const mailtoUrl = `mailto:?subject=${subject}&body=${body}`;
      
      // URL 길이 제한 확인 (일부 브라우저는 2000자 제한)
      if (mailtoUrl.length > 2000) {
        toast.warning("이메일 본문이 너무 깁니다. 링크 복사 기능을 사용해주세요.");
        // 링크만 포함한 간단한 버전으로 재시도
        const simpleBodyText = `업무 공유 링크:\n\n${shareLink}`;
        const simpleBody = encodeURIComponent(simpleBodyText);
        const simpleMailtoUrl = `mailto:?subject=${subject}&body=${simpleBody}`;
        window.location.href = simpleMailtoUrl;
        return;
      }
      
      window.location.href = mailtoUrl;
    } catch (error) {
      console.error("이메일 공유 실패:", error);
      toast.error("이메일 공유에 실패했습니다. 링크 복사 기능을 사용해주세요.");
    }
  };

  // 카카오톡 공유 기능 (피드 템플릿 - 링크 카드 형태)
  const handleKakaoShare = () => {
    const kakaoAppKey = import.meta.env.VITE_KAKAO_APP_KEY;
    
    if (!kakaoAppKey) {
      toast.error("카카오톡 공유 기능을 사용할 수 없습니다. 설정을 확인해주세요.");
      return;
    }

    // 카카오톡 SDK 로드 대기
    const checkKakaoSDK = () => {
      if (!window.Kakao) {
        setTimeout(checkKakaoSDK, 100);
        return;
      }

      // SDK 초기화 확인 및 초기화
      if (!window.Kakao.isInitialized()) {
        try {
          window.Kakao.init(kakaoAppKey);
        } catch (initError) {
          console.error('카카오톡 SDK 초기화 실패:', initError);
          toast.error("카카오톡 SDK 초기화에 실패했습니다.");
          return;
        }
      }

      // Task 제목 (최대 200자)
      const shareTitle = task.title.length > 200 
        ? task.title.substring(0, 197) + "..." 
        : task.title;

      // Task 설명 (최대 200자)
      const shareDescription = "Tasko에서 업무를 공유합니다. 링크를 클릭하여 자세히 확인하세요.";

      // OG 이미지 URL (절대 경로, HTTPS 필요)
      // 카카오톡은 HTTPS 이미지만 지원하며, localhost는 크롤링할 수 없습니다
      const frontendUrl = import.meta.env.VITE_FRONTEND_URL || window.location.origin;
      // HTTPS로 변환 (개발 환경에서는 localhost이므로 프로덕션에서만 동작)
      let ogImageUrl = `${frontendUrl}/images/og-image.png`;
      // HTTP를 HTTPS로 변환 (프로덕션 환경에서)
      if (ogImageUrl.startsWith('http://') && !ogImageUrl.includes('localhost')) {
        ogImageUrl = ogImageUrl.replace('http://', 'https://');
      }

      // 카카오톡 피드 템플릿 메시지 전송 (링크 카드 형태)
      try {
        // 피드 템플릿 구조 (카카오톡 API 문서 기준)
        // 이미지 URL이 유효하지 않으면 텍스트 형태로만 공유됩니다
        // 이미지 URL은 HTTPS로 시작하는 절대 경로여야 하며, 카카오톡이 접근 가능해야 합니다
        
        // 피드 템플릿 구조 (카카오톡 API 문서 기준)
        // content.link가 카드 전체를 클릭 가능하게 만듭니다
        // 링크가 동작하려면 절대 경로(HTTPS)여야 합니다
        const feedTemplate = {
          objectType: 'feed',
          content: {
            title: shareTitle,
            description: shareDescription,
            imageUrl: ogImageUrl,
            link: {
              mobileWebUrl: shareLink,
              webUrl: shareLink,
            },
          },
          buttons: [
            {
              title: '자세히 보기',
              link: {
                mobileWebUrl: shareLink,
                webUrl: shareLink,
              },
            },
          ],
        };

        // 링크 URL 검증 (카카오톡은 절대 경로 필요, localhost는 접근 불가)
        if (!shareLink.startsWith('http://') && !shareLink.startsWith('https://')) {
          console.error('링크가 절대 경로가 아닙니다:', shareLink);
          toast.error('공유 링크가 올바르지 않습니다.');
          return;
        }
        
        // localhost 경고 (카카오톡은 localhost에 접근할 수 없음)
        if (shareLink.includes('localhost') || shareLink.includes('127.0.0.1')) {
          toast.warning('localhost 도메인은 카카오톡에서 접근할 수 없습니다. 프로덕션 도메인을 사용해주세요.', {
            duration: 5000,
          });
          console.warn('카카오톡 공유 경고: localhost 도메인 사용 중');
          console.warn('프로덕션 환경에서는 VITE_FRONTEND_URL을 실제 도메인(예: https://tasko.io.kr)으로 설정해야 합니다.');
        }
        
        // 카카오톡 Share API 확인
        if (!window.Kakao.Share) {
          throw new Error('카카오톡 Share API를 찾을 수 없습니다.');
        }

        if (typeof window.Kakao.Share.sendDefault !== 'function') {
          throw new Error('카카오톡 Share.sendDefault 함수를 찾을 수 없습니다.');
        }
        
        // 피드 템플릿을 sendDefault로 전송
        // 이미지 URL이 유효하지 않으면 자동으로 텍스트 형태로 전환됩니다
        window.Kakao.Share.sendDefault(feedTemplate);
      } catch (error) {
        console.error('카카오톡 공유 실패:', error);
        console.error('에러 상세:', {
          error,
          stack: error instanceof Error ? error.stack : undefined,
          Kakao: window.Kakao ? Object.keys(window.Kakao) : 'Kakao not found',
          Share: window.Kakao?.Share ? Object.keys(window.Kakao.Share) : 'Share not found',
        });
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
        toast.error(`카카오톡 공유에 실패했습니다: ${errorMessage}`);
      }
    };

    // SDK 로드 확인 시작
    checkKakaoSDK();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>공유</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 공유 링크 섹션 */}
          <div className="flex flex-col gap-4">
            {/* 공유 버튼들 */}
            <div className="flex gap-4">
              {/* 이메일 공유 버튼 */}
              <div className="flex flex-col gap-1 w-fit items-center">
                <Button onClick={handleEmailShare} variant="outline" className="size-14 rounded-full bg-foreground ">
                  <Mail size={0} className='size-6 text-background dark:text-foreground'/>
                </Button>
                <span className="text-14-regular">이메일</span>
              </div>

              {/* 카카오톡 공유 버튼 */}
              <div className="flex flex-col gap-1 w-fit items-center">
                <Button 
                  onClick={handleKakaoShare} 
                  variant="outline" 
                  className="size-14 rounded-full !bg-[#FEE500]"
                >
                  <img src={kakaoLogo} alt="kakao" className="size-12 h-fit " />
                </Button>
                <span className="text-14-regular">카카오톡</span>
              </div>
            </div>

             {/* 링크 복사 */}
             <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Input value={shareLink} readOnly className="flex-1" />
                <Button onClick={handleCopyLink} variant="outline">
                  복사
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
