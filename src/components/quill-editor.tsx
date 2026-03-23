import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import Quill from "quill";
import "quill/dist/quill.snow.css";

const MODULES = {
  toolbar: [
    ["bold", "italic", "underline"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["clean"],
  ],
};

/** HTML 정규화 - Quill 정규화 차이로 인한 불필요한 재동기화 방지 (비교용) */
function normalizeForCompare(html: string): string {
  return html
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/<p><br>\s*<\/p>/gi, "")
    .trim();
}

export interface QuillEditorHandle {
  focus: () => void;
}

interface QuillEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

export const QuillEditor = forwardRef<QuillEditorHandle, QuillEditorProps>(
  ({ value, onChange, placeholder, className }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const quillRef = useRef<Quill | null>(null);
    const onChangeRef = useRef(onChange);
    const isInternalChangeRef = useRef(false);
    onChangeRef.current = onChange;

    useImperativeHandle(ref, () => ({
      focus: () => quillRef.current?.focus(),
    }));

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const q = new Quill(container, {
        theme: "snow",
        placeholder: placeholder ?? "내용을 입력하세요...",
        modules: MODULES,
      });

      q.on("text-change", () => {
        if (isInternalChangeRef.current) return;
        const html = q.root.innerHTML;
        onChangeRef.current(html);
      });

      const initial = value;
      if (initial && initial !== "<p><br></p>" && initial !== "<p></p>") {
        isInternalChangeRef.current = true;
        q.clipboard.dangerouslyPasteHTML(initial);
        isInternalChangeRef.current = false;
      }

      quillRef.current = q;
      return () => {
        quillRef.current = null;
      };
    }, []);

    // value가 외부에서 변경될 때 (템플릿, 대표님, DOCX 파싱 등) 에디터 내용 동기화
    useEffect(() => {
      const q = quillRef.current;
      if (!q) return;

      const current = q.root.innerHTML;
      const valueNorm = normalizeForCompare(value);
      const currentNorm = normalizeForCompare(current);

      // 정규화된 내용이 같으면 스킵 (Quill 정규화로 인한 불필요한 덮어쓰기 방지)
      if (valueNorm === currentNorm) return;

      const sel = q.getSelection();
      isInternalChangeRef.current = true;
      q.clipboard.dangerouslyPasteHTML(value);
      isInternalChangeRef.current = false;
      if (sel) q.setSelection(sel);
    }, [value]);

    return (
      <div className={`rounded-md border border-input ${className ?? ""}`}>
        <div
          ref={containerRef}
          className="[&_.ql-container]:min-h-[200px] [&_.ql-container]:max-h-[300px] [&_.ql-editor]:min-h-[200px]"
        />
      </div>
    );
  },
);

QuillEditor.displayName = "QuillEditor";
