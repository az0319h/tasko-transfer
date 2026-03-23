/**
 * DOCX 첨부용 파일명 변환 (Gotenberg 서버에서 PDF 변환 시 사용)
 * _초1, _초2 등 접미사 제거 후 .pdf로 변경
 *
 * 예: "[베이스]상표 지정상품제안서(볼텍스 버블 펄스 아쿠아 마스터)_초1.docx"
 *  → "[베이스]상표 지정상품제안서(볼텍스 버블 펄스 아쿠아 마스터).pdf"
 */
export function toPdfAttachmentFileName(docxFileName: string): string {
  const withoutExt = docxFileName.replace(/\.docx?$/i, "");
  const withoutSuffix = withoutExt.replace(/_초\d+$/, "");
  return `${withoutSuffix}.pdf`;
}
