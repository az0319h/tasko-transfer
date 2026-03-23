-- ============================================================================
-- Phase 1: Task 3 완전한 스키마 설정 마이그레이션
-- ============================================================================
-- 목적: @tasks.json Task 3 요구사항에 맞춰 모든 스키마 요소를 완성
-- 
-- 작업 내용:
-- 1. task_category ENUM 타입 확인 및 생성 (없는 경우)
-- 2. profiles 테이블 생성 (없는 경우) 및 트리거 설정
-- 3. project_participants 테이블 생성 (없는 경우)
-- 4. tasks 테이블에 task_category 컬럼 추가 (없는 경우)
-- 5. tasks 테이블에 description 컬럼 추가 (없는 경우)
-- 6. 컬럼명 정정 (projects.opportunity → title, tasks.instruction → title)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. task_category ENUM 타입 생성 (없는 경우)
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type 
    WHERE typname = 'task_category'
  ) THEN
    CREATE TYPE task_category AS ENUM (
      'REVIEW',
      'CONTRACT', 
      'SPECIFICATION',
      'APPLICATION'
    );
    
    COMMENT ON TYPE task_category IS 'Task 카테고리: REVIEW(검토), CONTRACT(계약), SPECIFICATION(명세서), APPLICATION(출원)';
    
    RAISE NOTICE 'task_category ENUM 타입을 생성했습니다.';
  ELSE
    RAISE NOTICE 'task_category ENUM 타입이 이미 존재합니다.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. profiles 테이블 생성 (없는 경우)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  profile_completed BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 프로필 생성 시 자동으로 profiles 레코드 생성하는 트리거 함수
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- auth.users에 INSERT 시 트리거 생성 (없는 경우)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- RLS 활성화 (없는 경우)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- updated_at 트리거
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);

COMMENT ON TABLE public.profiles IS '사용자 프로필 테이블: auth.users와 1:1 관계';
COMMENT ON COLUMN public.profiles.role IS '사용자 역할: admin 또는 member';
COMMENT ON COLUMN public.profiles.profile_completed IS '프로필 설정 완료 여부';
COMMENT ON COLUMN public.profiles.is_active IS '계정 활성화 여부';

-- ----------------------------------------------------------------------------
-- 3. project_participants 테이블 생성 (없는 경우)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.project_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES public.profiles(id),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

-- RLS 활성화 (없는 경우)
ALTER TABLE public.project_participants ENABLE ROW LEVEL SECURITY;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_project_participants_project_id ON public.project_participants(project_id);
CREATE INDEX IF NOT EXISTS idx_project_participants_user_id ON public.project_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_project_participants_invited_by ON public.project_participants(invited_by);

COMMENT ON TABLE public.project_participants IS '프로젝트 참여자 테이블: 프로젝트와 사용자의 다대다 관계';
COMMENT ON COLUMN public.project_participants.invited_by IS '참여자를 초대한 사용자 ID';

-- ----------------------------------------------------------------------------
-- 4. tasks 테이블: task_category 컬럼 추가 (없는 경우)
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tasks'
      AND column_name = 'task_category'
  ) THEN
    ALTER TABLE public.tasks
    ADD COLUMN task_category task_category NOT NULL DEFAULT 'REVIEW';
    
    RAISE NOTICE 'tasks 테이블에 task_category 컬럼을 추가했습니다.';
  ELSE
    RAISE NOTICE 'tasks 테이블에 task_category 컬럼이 이미 존재합니다.';
  END IF;
END $$;

-- task_category 인덱스 생성 (없는 경우)
CREATE INDEX IF NOT EXISTS idx_tasks_task_category ON public.tasks(task_category);

-- ----------------------------------------------------------------------------
-- 5. tasks 테이블: description 컬럼 추가 (없는 경우)
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tasks'
      AND column_name = 'description'
  ) THEN
    ALTER TABLE public.tasks
    ADD COLUMN description TEXT;
    
    RAISE NOTICE 'tasks 테이블에 description 컬럼을 추가했습니다.';
  ELSE
    RAISE NOTICE 'tasks 테이블에 description 컬럼이 이미 존재합니다.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 6. 컬럼명 정정: projects.opportunity → title
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  -- opportunity 컬럼이 있고 title 컬럼이 없는 경우
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name = 'opportunity'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name = 'title'
  ) THEN
    ALTER TABLE public.projects
    RENAME COLUMN opportunity TO title;
    
    RAISE NOTICE 'projects.opportunity 컬럼을 title로 변경했습니다.';
  -- opportunity와 title이 모두 있는 경우: opportunity를 제거하고 title 유지
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name = 'opportunity'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name = 'title'
  ) THEN
    -- opportunity의 데이터를 title로 병합 (title이 NULL인 경우만)
    UPDATE public.projects
    SET title = COALESCE(title, opportunity)
    WHERE title IS NULL OR title = '';
    
    ALTER TABLE public.projects
    DROP COLUMN opportunity;
    
    RAISE NOTICE 'projects.opportunity 컬럼을 제거하고 title을 유지했습니다.';
  -- title 컬럼이 없는 경우: 추가
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name = 'title'
  ) THEN
    ALTER TABLE public.projects
    ADD COLUMN title TEXT NOT NULL DEFAULT '';
    
    RAISE NOTICE 'projects 테이블에 title 컬럼을 추가했습니다.';
  ELSE
    RAISE NOTICE 'projects 테이블의 title 컬럼이 이미 올바르게 설정되어 있습니다.';
  END IF;
END $$;

-- title 컬럼에 NOT NULL 제약조건 추가 (없는 경우)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name = 'title'
      AND is_nullable = 'YES'
  ) THEN
    -- 기존 NULL 값을 빈 문자열로 변경
    UPDATE public.projects
    SET title = ''
    WHERE title IS NULL;
    
    -- NOT NULL 제약조건 추가
    ALTER TABLE public.projects
    ALTER COLUMN title SET NOT NULL;
    
    RAISE NOTICE 'projects.title 컬럼에 NOT NULL 제약조건을 추가했습니다.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 7. 컬럼명 정정: tasks.instruction → title
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  -- instruction 컬럼이 있고 title 컬럼이 없는 경우
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tasks'
      AND column_name = 'instruction'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tasks'
      AND column_name = 'title'
  ) THEN
    ALTER TABLE public.tasks
    RENAME COLUMN instruction TO title;
    
    RAISE NOTICE 'tasks.instruction 컬럼을 title로 변경했습니다.';
  -- instruction과 title이 모두 있는 경우: instruction을 제거하고 title 유지
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tasks'
      AND column_name = 'instruction'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tasks'
      AND column_name = 'title'
  ) THEN
    -- instruction의 데이터를 title로 병합 (title이 NULL인 경우만)
    UPDATE public.tasks
    SET title = COALESCE(title, instruction)
    WHERE title IS NULL OR title = '';
    
    ALTER TABLE public.tasks
    DROP COLUMN instruction;
    
    RAISE NOTICE 'tasks.instruction 컬럼을 제거하고 title을 유지했습니다.';
  -- title 컬럼이 없는 경우: 추가
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tasks'
      AND column_name = 'title'
  ) THEN
    ALTER TABLE public.tasks
    ADD COLUMN title TEXT NOT NULL DEFAULT '';
    
    RAISE NOTICE 'tasks 테이블에 title 컬럼을 추가했습니다.';
  ELSE
    RAISE NOTICE 'tasks 테이블의 title 컬럼이 이미 올바르게 설정되어 있습니다.';
  END IF;
END $$;

-- title 컬럼에 NOT NULL 제약조건 추가 (없는 경우)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tasks'
      AND column_name = 'title'
      AND is_nullable = 'YES'
  ) THEN
    -- 기존 NULL 값을 빈 문자열로 변경
    UPDATE public.tasks
    SET title = ''
    WHERE title IS NULL;
    
    -- NOT NULL 제약조건 추가
    ALTER TABLE public.tasks
    ALTER COLUMN title SET NOT NULL;
    
    RAISE NOTICE 'tasks.title 컬럼에 NOT NULL 제약조건을 추가했습니다.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 8. 불필요한 컬럼 제거 (기획에 없는 필드)
-- ----------------------------------------------------------------------------

-- projects.patent_name 제거 (기획에 없음)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name = 'patent_name'
  ) THEN
    ALTER TABLE public.projects
    DROP COLUMN patent_name;
    
    RAISE NOTICE 'projects.patent_name 컬럼을 제거했습니다.';
  END IF;
END $$;

-- projects.is_public 제거 (기획에 없음)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name = 'is_public'
  ) THEN
    ALTER TABLE public.projects
    DROP COLUMN is_public;
    
    RAISE NOTICE 'projects.is_public 컬럼을 제거했습니다.';
  END IF;
END $$;

-- projects.status 제거 (기획에 없음, project_status enum도 제거)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name = 'status'
  ) THEN
    ALTER TABLE public.projects
    DROP COLUMN status;
    
    RAISE NOTICE 'projects.status 컬럼을 제거했습니다.';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- 검증 쿼리 (수동 실행)
-- ============================================================================
-- ENUM 타입 확인:
-- SELECT typname FROM pg_type WHERE typname IN ('task_status', 'task_category', 'message_type');
--
-- 테이블 구조 확인:
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
--   AND table_name IN ('profiles', 'projects', 'project_participants', 'tasks', 'messages')
-- ORDER BY table_name, ordinal_position;
--
-- 프로필 자동 생성 트리거 확인:
-- SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_created';


