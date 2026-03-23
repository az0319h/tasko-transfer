import { useState, useRef, useEffect, type ReactNode, cloneElement, isValidElement } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface CustomDropdownProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: "start" | "end";
  className?: string;
}

/**
 * 커스텀 드롭다운 컴포넌트
 * shadcn DropdownMenu와 유사한 UX를 제공하지만 body에 side-effect를 주지 않음
 * - body에 pointer-events, overflow 스타일을 설정하지 않음
 * - focus-lock, portal, overlay 사용하지 않음
 * - 단순한 absolute positioning으로 구현
 */
export function CustomDropdown({
  trigger,
  children,
  align = "end",
  className,
}: CustomDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 감지
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    // 약간의 지연을 두어 현재 클릭 이벤트가 처리된 후 실행
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  // Escape 키로 닫기
  useEffect(() => {
    if (!open) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  // 포커스 관리
  useEffect(() => {
    if (open && contentRef.current) {
      // 첫 번째 포커스 가능한 요소에 포커스
      const firstFocusable = contentRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (firstFocusable) {
        firstFocusable.focus();
      }
    }
  }, [open]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div onClick={() => setOpen(!open)}>{trigger}</div>
          {open && (
        <div
          ref={contentRef}
          className={cn(
            "absolute z-50 mt-1 min-w-[8rem] rounded-md border bg-popover text-popover-foreground shadow-md p-1",
            align === "end" ? "right-0" : "left-0"
          )}
          role="menu"
          aria-orientation="vertical"
        >
          {/* children에 onClose prop 전달 */}
          {isValidElement(children)
            ? cloneElement(children as React.ReactElement<{ onClose?: () => void }>, {
                onClose: () => setOpen(false),
              })
            : Array.isArray(children)
            ? children.map((child, index) =>
                isValidElement(child)
                  ? cloneElement(child as React.ReactElement<{ onClose?: () => void }>, {
                      key: index,
                      onClose: () => setOpen(false),
                    })
                  : child
              )
            : children}
        </div>
      )}
    </div>
  );
}

interface CustomDropdownItemProps {
  children: ReactNode;
  onClick?: () => void;
  onClose?: () => void;
  className?: string;
  variant?: "default" | "destructive";
}

/**
 * 커스텀 드롭다운 아이템 컴포넌트
 */
export function CustomDropdownItem({
  children,
  onClick,
  onClose,
  className,
  variant = "default",
}: CustomDropdownItemProps) {
  const handleClick = () => {
    // 드롭다운 닫기 (부모에서 전달받은 onClose 호출)
    onClose?.();
    // onClick 실행
    onClick?.();
  };

  return (
    <button
      type="button"
      role="menuitem"
      onClick={handleClick}
      className={cn(
        "relative flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        "focus:bg-accent focus:text-accent-foreground",
        variant === "destructive" &&
          "text-destructive focus:bg-destructive/10 focus:text-destructive",
        className
      )}
    >
      {children}
    </button>
  );
}

