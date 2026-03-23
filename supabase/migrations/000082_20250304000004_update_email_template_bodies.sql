-- 특허/표장 이메일 템플릿 본문 업데이트 (특허_템플릿_utf8.htm, 표장_템플릿_utf8.htm 동일 반영)
-- 포맷: 굵기(strong), 밑줄(u), 하이퍼링크(a), 빈 줄, 줄바꿈(br)

-- LOGO (특허_템플릿_utf8.htm): [베이스] 특허 등록 가능성 검토 보고의 건
UPDATE public.email_templates
SET body_template = '<p><strong>대표님 메일:</strong></p>

<p>&nbsp;</p>

<p>[베이스] 특허 등록 가능성 검토 보고의 건</p>

<p>&nbsp;</p>

<p><strong>** ATTORNEY-CLIENT PRIVILEGED COMMUNICATION **</strong></p>

<p>&nbsp;</p>

<p>&nbsp;</p>

<p>안녕하세요. 대표님.</p>
<p>베이스특허 김성수 변리사입니다.</p>

<p>&nbsp;</p>

<p>특허 등록 가능성 검토가 완료되어 보고드립니다.</p>

<p>&nbsp;</p>

<p><strong>1. 문의주신 사항</strong></p>
<p>~~에 대한 발명의 특허 등록 가능성을 검토하였습니다.</p>

<p>&nbsp;</p>

<p><strong>2. 당소의 제안</strong></p>
<p>선행기술과 상이한 구성을 포함하고 이로 인한 효과도 현저하므로, <u>특허성을 주장할 여지가 충분하다고 사료됩니다.</u></p>

<p>&nbsp;</p>

<p><strong><u>따라서, 특허 출원을 진행하여 권리화 하시는 것을 제안드립니다.</u></strong></p>

<p>&nbsp;</p>

<p>천천히 검토하신 후, <strong><u>출원 진행 여부에 대한 의견을 회신 부탁드립니다.</u></strong></p>

<p>&nbsp;</p>

<p>자세한 내용은 첨부드린 검토 보고서를 확인해주시기 바랍니다.</p>
<p>다른 궁금하신 사항이 있으시면 언제든 편하게 문의해주시기 바랍니다.</p>

<p>&nbsp;</p>

<p>감사합니다.</p>
<p>김성수 드림</p>

<p>&nbsp;</p>

<p>&nbsp;</p>

<p><strong>변리사 김성수(Mr.)</strong></p>
<p>Patent attorney<br><u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u></p>
<p><strong>BASS </strong>Patent Law Office</p>
<p>서울특별시 송파구 올림픽로 300, 30층 3029호</p>
<p><strong>Tel </strong>: +82-10-4296-2559│ <strong>E-mail </strong>: <a href="mailto:bass@basspat.co">bass@basspat.co</a></p>
<p><u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u></p>
<p>This e-mail is intended for the exclusive use of the individual or entity named above and may<br>
constitute information that is privileged or confidential or otherwise protected from disclosure. </p>
<p>Dissemination, distribution, forwarding or copying of this e-mail by anyone other than</p>
<p>the intended recipient is prohibited. If you have received this e-mail in error, please notify us</p>
<p>immediately by telephone (+82-10-4296-2559) or e-mail(<a href="mailto:bass@basspat.co">bass@basspat.co</a>) and completely delete</p>
<p>or destroy any and all electronic or other copies of the original message.</p>'
WHERE type_code = 'LOGO';

-- TRADEMARK (표장_템플릿_utf8.htm): [베이스] 상표 등록 가능성 검토 보고의 건
UPDATE public.email_templates
SET body_template = '<p><strong>대표님 메일:</strong></p>

<p>&nbsp;</p>

<p>[베이스] 상표 등록 가능성 검토 보고의 건</p>

<p>&nbsp;</p>

<p><strong>** ATTORNEY-CLIENT PRIVILEGED COMMUNICATION **</strong></p>

<p>&nbsp;</p>

<p>&nbsp;</p>

<p>안녕하세요. 대표님.</p>
<p>베이스특허 김성수 변리사입니다.</p>

<p>&nbsp;</p>

<p>상표 등록 가능성 검토가 완료되어 보고드립니다.</p>

<p>&nbsp;</p>

<p><strong>1. 문의주신 사항</strong></p>
<p>표장 &#x201C;~~&#x201D;에 대한 상표 등록 가능성을 문의주셨습니다.</p>

<p>&nbsp;</p>

<p><strong>2. 당소의제안</strong></p>
<p>다른 상표와 구별되는 <u>식별력이 충분</u>하고, 선행 유사상표와 <u>지정상품이 상이</u>하여 출원 가능성이 높다고 판단되어 <strong><u>상표 출원을 제안드립니다.</u></strong></p>

<p>&nbsp;</p>

<p>천천히 검토하신 후, <strong><u>출원 진행 여부에 대한 의견을 회신 부탁드립니다.</u></strong></p>

<p>&nbsp;</p>

<p>자세한 사항은 첨부된 서류를 참고해주시기 바랍니다.</p>

<p>&nbsp;</p>

<p>다른 궁금하신 사항이 있으시면 언제든 편하게 문의해주시기 바랍니다.</p>

<p>&nbsp;</p>

<p>감사합니다.</p>
<p>김성수 드림</p>

<p>&nbsp;</p>

<p>&nbsp;</p>

<p><strong>변리사 김성수(Mr.)</strong></p>
<p>Patent attorney<br><u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u></p>
<p><strong>BASS </strong>Patent Law Office</p>
<p>서울특별시 송파구 올림픽로 300, 30층 3029호</p>
<p><strong>Tel </strong>: +82-10-4296-2559│ <strong>E-mail </strong>: <a href="mailto:bass@basspat.co">bass@basspat.co</a></p>
<p><u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u></p>
<p>This e-mail is intended for the exclusive use of the individual or entity named above and may<br>
constitute information that is privileged or confidential or otherwise protected from disclosure. </p>
<p>Dissemination, distribution, forwarding or copying of this e-mail by anyone other than</p>
<p>the intended recipient is prohibited. If you have received this e-mail in error, please notify us</p>
<p>immediately by telephone (+82-10-4296-2559) or e-mail(<a href="mailto:bass@basspat.co">bass@basspat.co</a>) and completely delete</p>
<p>or destroy any and all electronic or other copies of the original message.</p>'
WHERE type_code = 'TRADEMARK';
