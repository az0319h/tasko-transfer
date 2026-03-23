-- ============================================================================
-- agents 테이블 RLS 정책 수정: 모든 사용자 접근 가능하도록 변경
-- ============================================================================
-- 목적: 모든 인증된 사용자가 에이전트를 조회/생성할 수 있도록 변경
-- 
-- 변경 사항:
-- - SELECT: admin만 -> 모든 인증된 사용자
-- - INSERT: admin만 -> 모든 인증된 사용자
-- - UPDATE/DELETE: 자신이 생성한 것만 (변경 없음)
-- ============================================================================

BEGIN;

-- 기존 정책 삭제
DROP POLICY IF EXISTS "agents_select_admin_all" ON public.agents;
DROP POLICY IF EXISTS "agents_insert_admin" ON public.agents;
DROP POLICY IF EXISTS "agents_update_own" ON public.agents;
DROP POLICY IF EXISTS "agents_delete_own" ON public.agents;

-- SELECT: 모든 인증된 사용자가 모든 에이전트 조회 가능
CREATE POLICY "agents_select_all"
ON public.agents
FOR SELECT
TO authenticated
USING (true);

-- INSERT: 모든 인증된 사용자가 에이전트 생성 가능 (created_by는 자신의 ID로만 설정 가능)
CREATE POLICY "agents_insert_all"
ON public.agents
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
);

-- UPDATE: 자신이 생성한 에이전트만 수정 가능
CREATE POLICY "agents_update_own"
ON public.agents
FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- DELETE: 자신이 생성한 에이전트만 삭제 가능
CREATE POLICY "agents_delete_own"
ON public.agents
FOR DELETE
TO authenticated
USING (created_by = auth.uid());

COMMIT;
