/**
 * DOCX 파일에서 특허/상표 관련 문구 추출
 * mammoth.js extractRawText 사용 (https://github.com/mwilliamson/mammoth.js)
 * - 특허: "X에 대한 발명의 특허 출원을 문의주셨습니다" → X 반환
 * - 상표: '표장 "X"에 대한 상표 출원을 문의주셨습니다' → X 반환
 * - 특허 파싱은 <문의주신 내용> ~ <당소의 제안> 구간만 사용
 */

import mammoth from "mammoth";

/**
 * DOCX 원문에서 문의주신 내용 ~ 당소의 제안 구간 추출.
 * - 문서 내 "<문의주신 내용>" 리터럴이 있으면: 그 직후 ~ 당소의 제안 (보일러플레이트 제외)
 * - 없으면: 문의주신 사항/내용 ~ 당소의 제안
 * - 구간 없으면 전체 반환
 */
function extractInquirySection(text: string): string {
  const endRe = /(?:<)?당소의\s*제안(?:>)?/;
  const endMatch = text.match(endRe);
  if (!endMatch) return text;
  const endIdx = endMatch.index ?? text.length;

  const literalMarker = /<문의주신\s*내용>\s*/;
  const headerRe = /(?:<)?문의주신\s*(?:내용|사항)(?:>)?\s*[:：]?\s*/;

  const literalMatch = text.match(literalMarker);
  if (literalMatch && (literalMatch.index ?? 0) < endIdx) {
    const startIdx = (literalMatch.index ?? 0) + literalMatch[0].length;
    return text.slice(startIdx, endIdx).trim();
  }

  const headerMatch = text.match(headerRe);
  if (!headerMatch) return text;
  const startIdx = (headerMatch.index ?? 0) + headerMatch[0].length;
  if (endIdx <= startIdx) return text;
  return text.slice(startIdx, endIdx).trim();
}

/**
 * DOCX에서 "발명 1:", "발명 2:" 형식의 여러 발명 추출
 * - 파싱 대상: 문의주신 내용 ~ 당소의 제안 구간만
 * - 해당 형식이 있으면 배열 반환 (중복 제거)
 * - 없으면 null (단일 발명인 경우 extractPatentPhraseFromDocx 사용)
 */
export async function extractPatentPhrasesFromDocx(
  docxBuffer: ArrayBuffer,
): Promise<string[] | null> {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer: docxBuffer });
    const text = extractInquirySection(result.value);

    // "발명 1: 제목", "발명 2: 제목" ... 형식이 있을 때만 추출 (중복 제거)
    const multiMatch = text.matchAll(/발명\s*\d+\s*[:：]\s*([^\r\n]+)/g);
    const seen = new Set<string>();
    const phrases: string[] = [];
    for (const m of multiMatch) {
      const t = m[1].trim();
      if (t && t.length <= 500 && !seen.has(t)) {
        seen.add(t);
        phrases.push(t);
      }
    }
    return phrases.length > 0 ? phrases : null;
  } catch {
    return null;
  }
}

/** DOCX ArrayBuffer에서 특허 문구 추출 (단일). 파싱 대상: 문의주신 내용 ~ 당소의 제안 구간만. 없으면 null */
export async function extractPatentPhraseFromDocx(docxBuffer: ArrayBuffer): Promise<string | null> {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer: docxBuffer });
    const text = extractInquirySection(result.value);
    // 패턴 1: "X에 대한 발명의 특허 출원을 문의주셨습니다"
    let match = text.match(/([\s\S]+?)에\s*대한\s*발명의\s*특허\s*출원을\s*문의주셨습니다\.?/);
    // 패턴 2: "X에 대한 발명의 특허 등록 가능성을 검토하였습니다" (등록검토보고서 형식)
    if (!match) {
      match = text.match(/([\s\S]+?)에\s*대한\s*발명의\s*특허\s*등록\s*가능성(?:을\s*검토)?/);
    }
    // 패턴 3: "발명의 명칭: X" 또는 "발명의 명칭 X"
    if (!match) {
      match = text.match(/발명의\s*명칭\s*[:：]\s*([^\r\n]+?)(?:\r?\n|$)/);
    }
    // 패턴 4: "(X)_초" 형식 - 파일명과 유사한 괄호 내 문구
    if (!match) {
      match = text.match(/(?:특허\s*등록검토보고서\s*)?[\(\(]\s*([^)\）]+?)\s*[\)\)]\s*(?:_초|\s|$)/);
    }
    if (!match) return null;
    const phrase = match[1].trim();
    if (!phrase || phrase.length > 500) return null;
    return phrase;
  } catch {
    return null;
  }
}

/** DOCX ArrayBuffer에서 상표 문구 추출. 없으면 null */
export async function extractTrademarkPhraseFromDocx(docxBuffer: ArrayBuffer): Promise<string | null> {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer: docxBuffer });
    const text = result.value;
    // 패턴 1: 표장 "X"에 대한 상표 출원을 문의주셨습니다 (유니코드 따옴표 지원)
    let match =
      text.match(/표장\s*["\u201C\u201D「」『』"]([^"\u201C\u201D「」『』"]+)["\u201C\u201D「」『』"]\s*에\s*대한\s*상표\s*출원을\s*문의주셨습니다\.?/) ??
      text.match(/표장\s+"([^"]+)"\s+에\s*대한\s*상표\s*출원을\s*문의주셨습니다\.?/);
    // 패턴 2: 표장 "X"에 대한 상표 등록 가능성 검토 (등록검토보고서 형식)
    if (!match) {
      match =
        text.match(/표장\s*["\u201C\u201D「」『』"]([^"\u201C\u201D「」『』"]+)["\u201C\u201D「」『』"]\s*에\s*대한\s*상표\s*등록\s*가능성/) ??
        text.match(/표장\s+"([^"]+)"\s+에\s*대한\s*상표\s*등록\s*가능성/);
    }
    if (!match) return null;
    const phrase = match[1].trim();
    if (!phrase || phrase.length > 500) return null;
    return phrase;
  } catch {
    return null;
  }
}
