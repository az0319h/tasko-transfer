import { useEffect, useRef, useState } from "react";
import { QuillEditor } from "@/components/quill-editor";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEmailTemplates } from "@/hooks/queries/use-email-templates";
import { useSendConfirmEmail } from "@/hooks/mutations/use-send-confirm-email";
import { useMessages } from "@/hooks/queries/use-messages";
import { getTaskFileDownloadUrl } from "@/api/storage";
import { toPdfAttachmentFileName } from "@/utils/docx-to-pdf";
import {
  extractPatentPhraseFromDocx,
  extractPatentPhrasesFromDocx,
  extractTrademarkPhraseFromDocx,
} from "@/utils/docx-parse";

interface ConfirmEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  taskTitle?: string;
}

export function ConfirmEmailDialog({
  open,
  onOpenChange,
  taskId,
  taskTitle,
}: ConfirmEmailDialogProps) {
  const [selectedTypeCode, setSelectedTypeCode] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [attachmentFileName, setAttachmentFileName] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const { data: templates = [], isLoading: templatesLoading } = useEmailTemplates();
  const { data: messages = [] } = useMessages(taskId);
  const sendConfirmEmail = useSendConfirmEmail();

  const selectedTemplate = templates.find((t) => t.type_code === selectedTypeCode);
  const contentRef = useRef(htmlContent);
  const prevTemplateRef = useRef<string | undefined>(undefined);
  contentRef.current = htmlContent;

  // 템플릿 선택 시 본문 로드
  useEffect(() => {
    if (!selectedTemplate?.body_template) return;

    const templateChanged = prevTemplateRef.current !== selectedTemplate.body_template;
    prevTemplateRef.current = selectedTemplate.body_template;

    if (templateChanged) {
      setHtmlContent(selectedTemplate.body_template);
    }
  }, [selectedTemplate?.body_template]);

  useEffect(() => {
    if (selectedTemplate?.subject_template) {
      setSubject(selectedTemplate.subject_template);
    }
  }, [selectedTemplate?.subject_template]);

  // 다이얼로그 닫을 때 본문 초기화
  useEffect(() => {
    if (!open) {
      setHtmlContent("");
      prevTemplateRef.current = undefined;
    }
  }, [open]);

  const fileMessages = messages.filter((m) => m.message_type === "FILE");
  const lastFile = fileMessages[fileMessages.length - 1];
  const isDocx = lastFile?.file_name && /\.docx$/i.test(lastFile.file_name);
  const lastFileName = lastFile?.file_name ?? "";
  const defaultAttachmentBaseName = isDocx
    ? toPdfAttachmentFileName(lastFileName).replace(/\.pdf$/i, "")
    : lastFileName;
  const defaultAttachmentFileName = isDocx ? toPdfAttachmentFileName(lastFileName) : lastFileName;

  const baseForDocx = (attachmentFileName.trim().replace(/\.pdf$/i, "") || defaultAttachmentBaseName).trim() || defaultAttachmentBaseName;
  const finalAttachmentFileName = isDocx ? `${baseForDocx}.pdf` : (attachmentFileName.trim() || defaultAttachmentFileName);

  const attachment =
    lastFile?.file_url && lastFile?.file_name
      ? {
          url: getTaskFileDownloadUrl(lastFile.file_url),
          fileName: isDocx ? lastFile.file_name : finalAttachmentFileName,
          outputFileName: isDocx ? finalAttachmentFileName : undefined,
        }
      : undefined;

  useEffect(() => {
    if (!lastFile?.file_name) {
      setAttachmentFileName("");
    } else if (/\.docx$/i.test(lastFile.file_name)) {
      setAttachmentFileName(toPdfAttachmentFileName(lastFile.file_name).replace(/\.pdf$/i, ""));
    } else {
      setAttachmentFileName(lastFile.file_name);
    }
  }, [lastFile?.file_name]);

  /** LOGO(특허) 또는 TRADEMARK(표장) + 마지막 DOCX일 때 본문을 DOCX에서 추출한 문구로 자동 채움 */
  useEffect(() => {
    if (
      !open ||
      (selectedTypeCode !== "LOGO" && selectedTypeCode !== "TRADEMARK") ||
      !attachment?.url ||
      !lastFile?.file_name ||
      !/\.docx$/i.test(lastFile.file_name) ||
      !selectedTemplate?.body_template
    )
      return;

    // 템플릿 로드와 DOCX effect가 동시에 실행될 수 있음 → contentRef에 ~~ 없을 때 템플릿 원문 사용
    const baseContent =
      contentRef.current?.includes("~~") ? contentRef.current : selectedTemplate.body_template;
    if (!baseContent.includes("~~")) return;

    const BOILERPLATE =
      /문의주신 내용에 대해 아래와 같이 보고 드리오니 참고하시어 출원 진행 여부에 대한 의견을 주시기를 바랍니다\.\s*(?:<문의주신 내용>|&lt;문의주신 내용&gt;)\s*/g;

    let cancelled = false;
    const typeCode = selectedTypeCode;
    const templateBody = selectedTemplate.body_template;
    const fileUrl = attachment!.url;

    (async () => {
      try {
        const res = await fetch(fileUrl);
        if (!res.ok || cancelled) return;
        const buffer = await res.arrayBuffer();

        if (typeCode === "LOGO") {
          const sectionRe =
            /(<p><strong>1\.\s*문의주신\s*사항<\/strong><\/p>)([\s\S]*?)(<p><strong>2\.\s*당소의[^<]*<\/strong><\/p>)/i;
          const currentBase = contentRef.current?.includes("~~") ? contentRef.current : templateBody;

          // "발명 1:", "발명 2:" 형식이 있으면 → 여러 발명 목록
          const phrases = await extractPatentPhrasesFromDocx(buffer);
          if (phrases?.length && !cancelled) {
            const intro = "<p>아래와 같은 특허 발명 가능성을 검토하였습니다.</p>";
            const listItems = phrases
              .map((title, i) => `<p>발명 ${i + 1}: ${title}</p>`)
              .join("");
            const sectionContent = `${intro}<p>&nbsp;</p>${listItems}`;
            let filled = currentBase.replace(sectionRe, `$1${sectionContent}<p>&nbsp;</p>$3`);
            if (!filled.includes("아래와 같은 특허 발명 가능성")) {
              filled = currentBase.replace(/~~/g, phrases[0]);
            }
            filled = filled.replace(BOILERPLATE, "");
            setHtmlContent(filled);
            return;
          }

          // 단일 발명 형식: "X에 대한 발명의 특허 출원을 문의주셨습니다"
          const phrase = await extractPatentPhraseFromDocx(buffer);
          if (!phrase || cancelled) return;
          const line = `${phrase}에 대한 발명의 특허 등록 가능성을 검토하였습니다.`;
          let filled = currentBase.replace(sectionRe, `$1<p>${line}</p><p>&nbsp;</p>$3`);
          if (!filled.includes(line)) {
            filled = currentBase.replace(/~~/g, phrase);
          }
          filled = filled.replace(BOILERPLATE, "");
          if (!cancelled) setHtmlContent(filled);
        } else {
          // 표장 탭: 표장 DOCX 형식만 파싱 (표장 "X"에 대한 상표...) - 파일명 fallback 없음
          // 특허 보고서 파일명 (X)은 발명명이라 표장 문장에 넣으면 안 됨
          const phrase = await extractTrademarkPhraseFromDocx(buffer);
          if (!phrase || cancelled) return;
          const currentBase = contentRef.current?.includes("~~") ? contentRef.current : templateBody;
          const filled = currentBase.replace(/~~/g, phrase);
          if (!cancelled) setHtmlContent(filled);
        }
      } catch (err) {
        if (!cancelled) console.error("[confirm-email] DOCX 파싱 실패:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    open,
    selectedTypeCode,
    attachment?.url,
    lastFile?.file_name,
    selectedTemplate?.body_template,
  ]);

  const handleSubmit = async () => {
    if (!selectedTypeCode || !subject.trim()) return;

    const rawHtml = htmlContent;
    if (!rawHtml || rawHtml === "<p><br></p>" || rawHtml === "<p></p>") {
      return;
    }
    const withCompactMargins = rawHtml.replace(/<p>/g, '<p style="margin:0 0 6px 0">');
    const htmlBody = `<div style="font-size: 16px; line-height: 1.25;">${withCompactMargins}</div>`;

    await sendConfirmEmail.mutateAsync({
      taskId,
      subject: subject.trim(),
      htmlBody,
      attachment,
    });

    onOpenChange(false);
    setSelectedTypeCode("");
    setSubject("");
    setHtmlContent("");
  };

  const isEmpty = !htmlContent || htmlContent === "<p><br></p>" || htmlContent === "<p></p>";
  const isPending = sendConfirmEmail.isPending;
  const canSubmit = selectedTypeCode && subject.trim() && !isEmpty;

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!w-[90%] !max-w-300 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>확인 이메일 전송</DialogTitle>
          {taskTitle && (
            <p className="text-muted-foreground text-sm">업무: {taskTitle}</p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="template-type">특허 / 표장</Label>
            <Select
              value={selectedTypeCode}
              onValueChange={setSelectedTypeCode}
              disabled={templatesLoading}
            >
              <SelectTrigger id="template-type">
                <SelectValue placeholder="선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.type_code}>
                    {t.email_template_types?.label ?? t.type_code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedTemplate && (
            <>
              <div className="space-y-2">
                <Label htmlFor="subject">이메일 제목</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="제목 입력"
                />
              </div>

              <div className="space-y-2">
                <Label>이메일 본문 (수정 가능)</Label>
                <QuillEditor
                  value={htmlContent}
                  onChange={setHtmlContent}
                  placeholder="본문 입력..."
                />
              </div>

              {lastFile && (
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-sm">첨부 예정</Label>
                  <div className="flex flex-wrap items-center gap-1.5 text-sm">
                    <Input
                      value={attachmentFileName}
                      onChange={(e) => setAttachmentFileName(e.target.value)}
                      placeholder={defaultAttachmentBaseName || "파일명"}
                      className="h-8 flex-1 min-w-[120px] max-w-[320px]"
                    />
                    {isDocx && <span className="text-muted-foreground shrink-0">.pdf (DOCX→PDF 변환)</span>}
                    <span className="text-muted-foreground shrink-0">(채팅의 맨 마지막 파일)</span>
                  </div>
                </div>
              )}
              {!lastFile && (
                <p className="text-muted-foreground text-sm">첨부할 파일이 없습니다.</p>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || isPending}
          >
            {sendConfirmEmail.isPending ? "발송 중..." : "완료 (발송)"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
