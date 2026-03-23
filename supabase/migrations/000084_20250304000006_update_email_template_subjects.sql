-- 이메일 템플릿 제목 업데이트 (특허/표장)
UPDATE public.email_templates
SET subject_template = '[베이스] 특허 등록 가능성 검토 보고의 건'
WHERE type_code = 'LOGO';

UPDATE public.email_templates
SET subject_template = '[베이스] 상표 등록 가능성 검토 보고의 건'
WHERE type_code = 'TRADEMARK';
