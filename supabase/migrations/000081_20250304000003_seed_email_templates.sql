-- 표장/상표 타입 시딩
INSERT INTO public.email_template_types (code, label, display_order)
VALUES
  ('TRADEMARK', '표장', 1),
  ('LOGO', '특허', 2)
ON CONFLICT (code) DO NOTHING;

-- 기본 템플릿 시딩 (placeholder - docx 내용으로 추후 업데이트)
INSERT INTO public.email_templates (type_code, subject_template, body_template)
SELECT 'TRADEMARK', '[베이스] 상표 등록 가능성 검토 보고의 건', '<p>컨펌 확인 요청입니다.</p>'
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE type_code = 'TRADEMARK');

INSERT INTO public.email_templates (type_code, subject_template, body_template)
SELECT 'LOGO', '[베이스] 특허 등록 가능성 검토 보고의 건', '<p>컨펌 확인 요청입니다.</p>'
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE type_code = 'LOGO');
