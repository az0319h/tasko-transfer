import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router";

/**
 * SPA 환경에서 React Router를 사용할 때 스크롤 위치를 복원하는 컴포넌트
 * 
 * 동작 원리:
 * - 페이지를 떠날 때(PUSH): 현재 경로와 스크롤 위치를 sessionStorage에 저장
 * - 뒤로가기/앞으로가기(POP) 시: 저장된 스크롤 위치로 복원
 * 
 * 주의: GlobalLayout의 overflow-y-auto div가 실제 스크롤 컨테이너이므로
 * window.scrollY가 아닌 해당 컨테이너의 scrollTop을 사용합니다.
 */
export default function ScrollRestoration() {
  const { pathname } = useLocation();
  const navType = useNavigationType();
  const prevPathRef = useRef(pathname);
  const scrollYRef = useRef(0);

  // 실제 스크롤 컨테이너 찾기 (GlobalLayout의 overflow-y-auto div)
  const getScrollContainer = (): HTMLElement | null => {
    // GlobalLayout의 main > div.overflow-y-auto 요소 찾기
    const container = document.querySelector('main div.overflow-y-auto') as HTMLElement;
    if (container) return container;
    
    // fallback: window 스크롤 사용
    return null;
  };

  // 1. 현재 스크롤 위치 추적
  useEffect(() => {
    const container = getScrollContainer();
    
    const saveScroll = () => {
      if (container) {
        scrollYRef.current = container.scrollTop;
      } else {
        scrollYRef.current = window.scrollY;
      }
    };

    if (container) {
      container.addEventListener("scroll", saveScroll, { passive: true });
      return () => container.removeEventListener("scroll", saveScroll);
    } else {
      window.addEventListener("scroll", saveScroll, { passive: true });
      return () => window.removeEventListener("scroll", saveScroll);
    }
  }, []);

  useLayoutEffect(() => {
    const container = getScrollContainer();

    // 페이지 이동(PUSH)할 때: 떠나는 페이지 위치 저장
    if (navType === "PUSH") {
      const prevPath = prevPathRef.current;
      if (prevPath !== pathname) {
        sessionStorage.setItem(`scroll_${prevPath}`, scrollYRef.current.toString());
      }
      // 새 페이지는 스크롤을 최상단으로
      if (container) {
        container.scrollTop = 0;
      } else {
        window.scrollTo(0, 0);
      }
    }
    // 뒤로가기(POP) 할 때: 저장된 위치로 복원 (여러 번 시도)
    else if (navType === "POP") {
      const saved = Number(sessionStorage.getItem(`scroll_${pathname}`)) || 0;
      let tries = 0;
      
      const restore = () => {
        if (container) {
          container.scrollTop = saved;
          // DOM 렌더링이 완료되지 않았을 수 있으므로 재시도
          if (Math.abs(container.scrollTop - saved) > 1 && tries++ < 10) {
            setTimeout(restore, 50);
          }
        } else {
          window.scrollTo(0, saved);
          if (Math.abs(window.scrollY - saved) > 1 && tries++ < 10) {
            setTimeout(restore, 50);
          }
        }
      };
      
      // 약간의 지연 후 복원 시도 (DOM 렌더링 완료 대기)
      setTimeout(restore, 0);
    }
    prevPathRef.current = pathname;
  }, [pathname, navType]);

  return null;
}
