-- 컨펌 이메일 템플릿 타입 (표장/상표)
CREATE TABLE IF NOT EXISTS public.email_template_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  display_order INT DEFAULT 0
);

COMMENT ON TABLE public.email_template_types IS '컨펌 이메일 템플릿 타입 (표장, 상표 등)';

-- 컨펌 이메일 템플릿 (타입별 HTML 본문)
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_code TEXT NOT NULL REFERENCES public.email_template_types(code) ON DELETE CASCADE,
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.email_templates IS '컨펌 이메일 템플릿 (표장/상표별 제목, 본문 HTML)';

-- RLS: 인증된 사용자만 읽기 가능 (담당자가 템플릿 조회)
ALTER TABLE public.email_template_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read email_template_types"
  ON public.email_template_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read email_templates"
  ON public.email_templates FOR SELECT
  TO authenticated
  USING (true);
