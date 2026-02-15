-- ============================================
-- Phase 1: AuthN/AuthZ Foundation
-- Adds project_members, project_api_keys tables,
-- helper SQL functions, data backfill, and
-- migrates all RLS policies from single-owner
-- to membership-based access control.
--
-- IMPORTANT: This is a single-transaction migration
-- to avoid a window where old policies are dropped
-- but new ones aren't active.
-- ============================================

-- ============================================
-- 1. NEW TABLES (must come before helper functions that reference them)
-- ============================================

-- project_members: tracks who has access to which projects
CREATE TABLE IF NOT EXISTS public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending')),
  invited_email text,
  invited_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  signup_invite_id uuid REFERENCES public.invites(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique: one active membership per user per project
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_members_project_user
  ON public.project_members (project_id, user_id)
  WHERE user_id IS NOT NULL;

-- Unique: one pending invite per email per project
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_members_pending_invite
  ON public.project_members (project_id, invited_email)
  WHERE status = 'pending' AND invited_email IS NOT NULL;

-- Lookup by user_id for "list my projects"
CREATE INDEX IF NOT EXISTS idx_project_members_user_id
  ON public.project_members (user_id)
  WHERE user_id IS NOT NULL AND status = 'active';

-- Enable RLS
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;


-- ============================================
-- 2. HELPER FUNCTIONS (after tables exist)
-- ============================================

-- Check if a user has active membership in a project
-- SECURITY DEFINER: bypasses RLS on project_members to avoid infinite recursion
-- (project_members RLS policies themselves call this function)
CREATE OR REPLACE FUNCTION public.user_has_project_access(p_project_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id
      AND user_id = p_user_id
      AND status = 'active'
  );
$$;

-- Check if a user has a specific role in a project
-- SECURITY DEFINER: same reason as above
CREATE OR REPLACE FUNCTION public.user_has_project_role(p_project_id uuid, p_user_id uuid, p_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id
      AND user_id = p_user_id
      AND status = 'active'
      AND role = p_role
  );
$$;

-- Revoke public access, grant to authenticated + service_role
REVOKE EXECUTE ON FUNCTION public.user_has_project_access FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_has_project_access TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.user_has_project_role FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_has_project_role TO authenticated, service_role;


-- Members can view their project's members
CREATE POLICY "Members can view project members"
  ON public.project_members FOR SELECT
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  );

-- Owners can insert project members (invite)
CREATE POLICY "Owners can insert project members"
  ON public.project_members FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_project_role(project_id, auth.uid(), 'owner')
  );

-- Owners can update project members
CREATE POLICY "Owners can update project members"
  ON public.project_members FOR UPDATE
  TO authenticated
  USING (
    public.user_has_project_role(project_id, auth.uid(), 'owner')
  )
  WITH CHECK (
    public.user_has_project_role(project_id, auth.uid(), 'owner')
  );

-- Owners can delete project members
CREATE POLICY "Owners can delete project members"
  ON public.project_members FOR DELETE
  TO authenticated
  USING (
    public.user_has_project_role(project_id, auth.uid(), 'owner')
  );

-- Members can update their own row (for accepting invites)
CREATE POLICY "Members can accept their own invites"
  ON public.project_members FOR UPDATE
  TO authenticated
  USING (
    (user_id = auth.uid() OR invited_email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    AND status = 'pending'
  )
  WITH CHECK (
    (user_id = auth.uid() OR invited_email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  );

-- Service role has full access
CREATE POLICY "Service role manages project members"
  ON public.project_members
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- project_api_keys: scoped API keys for programmatic access
CREATE TABLE IF NOT EXISTS public.project_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_hash text NOT NULL,
  key_prefix text NOT NULL,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Fast lookup by key_hash (used for every API key auth)
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_api_keys_key_hash
  ON public.project_api_keys (key_hash);

-- Lookup by project_id
CREATE INDEX IF NOT EXISTS idx_project_api_keys_project_id
  ON public.project_api_keys (project_id);

-- Enable RLS
ALTER TABLE public.project_api_keys ENABLE ROW LEVEL SECURITY;

-- Members can view API keys for their projects
CREATE POLICY "Members can view project API keys"
  ON public.project_api_keys FOR SELECT
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  );

-- Owners can create API keys (C2 fix: user-scoped, not admin)
CREATE POLICY "Owners can create project API keys"
  ON public.project_api_keys FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_project_role(project_id, auth.uid(), 'owner')
    AND created_by_user_id = auth.uid()
  );

-- Owners can update API keys (e.g., revoke)
CREATE POLICY "Owners can update project API keys"
  ON public.project_api_keys FOR UPDATE
  TO authenticated
  USING (
    public.user_has_project_role(project_id, auth.uid(), 'owner')
  );

-- Service role has full access (for last_used_at updates from proxy)
CREATE POLICY "Service role manages project API keys"
  ON public.project_api_keys
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ============================================
-- 3. DATA BACKFILL
-- Populate project_members from existing projects
-- ============================================

INSERT INTO public.project_members (project_id, user_id, role, status)
SELECT id, user_id, 'owner', 'active'
FROM public.projects
WHERE user_id IS NOT NULL
ON CONFLICT DO NOTHING;


-- ============================================
-- 4. RLS POLICY MIGRATION
-- Replace single-owner checks with membership checks.
-- Uses DROP POLICY IF EXISTS + CREATE POLICY pairs.
-- ============================================

-- ----------------------------------------
-- PROJECTS TABLE
-- ----------------------------------------

-- SELECT: members can view projects they belong to
DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
CREATE POLICY "Members can view their projects"
  ON public.projects FOR SELECT
  TO authenticated
  USING (
    public.user_has_project_access(id, auth.uid())
  );

-- INSERT: creator sets user_id = self (unchanged semantics)
DROP POLICY IF EXISTS "Users can insert their own projects" ON public.projects;
CREATE POLICY "Users can create projects"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: only owners can update projects
DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
CREATE POLICY "Owners can update their projects"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (
    public.user_has_project_role(id, auth.uid(), 'owner')
  )
  WITH CHECK (
    public.user_has_project_role(id, auth.uid(), 'owner')
  );

-- DELETE: only owners can delete projects
DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;
CREATE POLICY "Owners can delete their projects"
  ON public.projects FOR DELETE
  TO authenticated
  USING (
    public.user_has_project_role(id, auth.uid(), 'owner')
  );


-- ----------------------------------------
-- SESSIONS TABLE
-- ----------------------------------------

DROP POLICY IF EXISTS "Users can view sessions for their projects" ON public.sessions;
CREATE POLICY "Members can view sessions for their projects"
  ON public.sessions FOR SELECT
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert sessions for their projects" ON public.sessions;
CREATE POLICY "Members can insert sessions for their projects"
  ON public.sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can update sessions for their projects" ON public.sessions;
CREATE POLICY "Members can update sessions for their projects"
  ON public.sessions FOR UPDATE
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  )
  WITH CHECK (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete sessions for their projects" ON public.sessions;
CREATE POLICY "Members can delete sessions for their projects"
  ON public.sessions FOR DELETE
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  );


-- ----------------------------------------
-- SESSION_MESSAGES TABLE
-- ----------------------------------------

DROP POLICY IF EXISTS "Users can view session messages for their projects" ON public.session_messages;
CREATE POLICY "Members can view session messages for their projects"
  ON public.session_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_messages.session_id
        AND public.user_has_project_access(s.project_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert session messages for their projects" ON public.session_messages;
CREATE POLICY "Members can insert session messages for their projects"
  ON public.session_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_messages.session_id
        AND public.user_has_project_access(s.project_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update session messages for their projects" ON public.session_messages;
CREATE POLICY "Members can update session messages for their projects"
  ON public.session_messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_messages.session_id
        AND public.user_has_project_access(s.project_id, auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_messages.session_id
        AND public.user_has_project_access(s.project_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete session messages for their projects" ON public.session_messages;
CREATE POLICY "Members can delete session messages for their projects"
  ON public.session_messages FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_messages.session_id
        AND public.user_has_project_access(s.project_id, auth.uid())
    )
  );


-- ----------------------------------------
-- SESSION_REVIEWS TABLE
-- ----------------------------------------

DROP POLICY IF EXISTS "Users can view their session reviews" ON public.session_reviews;
CREATE POLICY "Members can view session reviews"
  ON public.session_reviews FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_reviews.session_id
        AND public.user_has_project_access(s.project_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert session reviews for their projects" ON public.session_reviews;
CREATE POLICY "Members can insert session reviews"
  ON public.session_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_reviews.session_id
        AND public.user_has_project_access(s.project_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their session reviews" ON public.session_reviews;
CREATE POLICY "Members can update session reviews"
  ON public.session_reviews FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_reviews.session_id
        AND public.user_has_project_access(s.project_id, auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_reviews.session_id
        AND public.user_has_project_access(s.project_id, auth.uid())
    )
  );


-- ----------------------------------------
-- ISSUES TABLE
-- ----------------------------------------

DROP POLICY IF EXISTS "Users can view issues for their projects" ON public.issues;
CREATE POLICY "Members can view issues for their projects"
  ON public.issues FOR SELECT
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert issues for their projects" ON public.issues;
CREATE POLICY "Members can insert issues for their projects"
  ON public.issues FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can update issues for their projects" ON public.issues;
CREATE POLICY "Members can update issues for their projects"
  ON public.issues FOR UPDATE
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  )
  WITH CHECK (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete issues for their projects" ON public.issues;
CREATE POLICY "Members can delete issues for their projects"
  ON public.issues FOR DELETE
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  );


-- ----------------------------------------
-- ISSUE_SESSIONS TABLE
-- ----------------------------------------

DROP POLICY IF EXISTS "Users can view issue_sessions for their issues" ON public.issue_sessions;
CREATE POLICY "Members can view issue_sessions"
  ON public.issue_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.issues i
      WHERE i.id = issue_sessions.issue_id
        AND public.user_has_project_access(i.project_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert issue_sessions for their issues" ON public.issue_sessions;
CREATE POLICY "Members can insert issue_sessions"
  ON public.issue_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.issues i
      WHERE i.id = issue_sessions.issue_id
        AND public.user_has_project_access(i.project_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete issue_sessions for their issues" ON public.issue_sessions;
CREATE POLICY "Members can delete issue_sessions"
  ON public.issue_sessions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.issues i
      WHERE i.id = issue_sessions.issue_id
        AND public.user_has_project_access(i.project_id, auth.uid())
    )
  );


-- ----------------------------------------
-- ISSUE_EMBEDDINGS TABLE
-- ----------------------------------------

DROP POLICY IF EXISTS "Users can view issue embeddings for their projects" ON public.issue_embeddings;
CREATE POLICY "Members can view issue embeddings"
  ON public.issue_embeddings FOR SELECT
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert issue embeddings for their projects" ON public.issue_embeddings;
CREATE POLICY "Members can insert issue embeddings"
  ON public.issue_embeddings FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can update issue embeddings for their projects" ON public.issue_embeddings;
CREATE POLICY "Members can update issue embeddings"
  ON public.issue_embeddings FOR UPDATE
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  )
  WITH CHECK (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete issue embeddings for their projects" ON public.issue_embeddings;
CREATE POLICY "Members can delete issue embeddings"
  ON public.issue_embeddings FOR DELETE
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  );


-- ----------------------------------------
-- ISSUE_SPEC_RUNS TABLE
-- ----------------------------------------

DROP POLICY IF EXISTS "Users can view their issue spec runs" ON public.issue_spec_runs;
CREATE POLICY "Members can view issue spec runs"
  ON public.issue_spec_runs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.issues i
      WHERE i.id = issue_spec_runs.issue_id
        AND public.user_has_project_access(i.project_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert spec runs for their projects" ON public.issue_spec_runs;
CREATE POLICY "Members can insert issue spec runs"
  ON public.issue_spec_runs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.issues i
      WHERE i.id = issue_spec_runs.issue_id
        AND public.user_has_project_access(i.project_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their issue spec runs" ON public.issue_spec_runs;
CREATE POLICY "Members can update issue spec runs"
  ON public.issue_spec_runs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.issues i
      WHERE i.id = issue_spec_runs.issue_id
        AND public.user_has_project_access(i.project_id, auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.issues i
      WHERE i.id = issue_spec_runs.issue_id
        AND public.user_has_project_access(i.project_id, auth.uid())
    )
  );


-- ----------------------------------------
-- ISSUE_ANALYSIS_RUNS TABLE
-- ----------------------------------------

DROP POLICY IF EXISTS "Users can view analysis runs for their project issues" ON public.issue_analysis_runs;
CREATE POLICY "Members can view issue analysis runs"
  ON public.issue_analysis_runs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.issues i
      WHERE i.id = issue_analysis_runs.issue_id
        AND public.user_has_project_access(i.project_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert analysis runs for their projects" ON public.issue_analysis_runs;
CREATE POLICY "Members can insert issue analysis runs"
  ON public.issue_analysis_runs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.issues i
      WHERE i.id = issue_analysis_runs.issue_id
        AND public.user_has_project_access(i.project_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their issue analysis runs" ON public.issue_analysis_runs;
CREATE POLICY "Members can update issue analysis runs"
  ON public.issue_analysis_runs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.issues i
      WHERE i.id = issue_analysis_runs.issue_id
        AND public.user_has_project_access(i.project_id, auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.issues i
      WHERE i.id = issue_analysis_runs.issue_id
        AND public.user_has_project_access(i.project_id, auth.uid())
    )
  );


-- ----------------------------------------
-- PROJECT_SETTINGS TABLE
-- ----------------------------------------

DROP POLICY IF EXISTS "Users can view settings for their projects" ON public.project_settings;
CREATE POLICY "Members can view project settings"
  ON public.project_settings FOR SELECT
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert settings for their projects" ON public.project_settings;
CREATE POLICY "Members can insert project settings"
  ON public.project_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can update settings for their projects" ON public.project_settings;
CREATE POLICY "Members can update project settings"
  ON public.project_settings FOR UPDATE
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  )
  WITH CHECK (
    public.user_has_project_access(project_id, auth.uid())
  );


-- ----------------------------------------
-- KNOWLEDGE_SOURCES TABLE
-- ----------------------------------------

DROP POLICY IF EXISTS "Users can view knowledge sources for their projects" ON public.knowledge_sources;
CREATE POLICY "Members can view knowledge sources"
  ON public.knowledge_sources FOR SELECT
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert knowledge sources for their projects" ON public.knowledge_sources;
CREATE POLICY "Members can insert knowledge sources"
  ON public.knowledge_sources FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can update knowledge sources for their projects" ON public.knowledge_sources;
CREATE POLICY "Members can update knowledge sources"
  ON public.knowledge_sources FOR UPDATE
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  )
  WITH CHECK (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete knowledge sources for their projects" ON public.knowledge_sources;
CREATE POLICY "Members can delete knowledge sources"
  ON public.knowledge_sources FOR DELETE
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  );


-- ----------------------------------------
-- KNOWLEDGE_PACKAGES TABLE
-- ----------------------------------------

DROP POLICY IF EXISTS "Users can view knowledge packages for their projects" ON public.knowledge_packages;
CREATE POLICY "Members can view knowledge packages"
  ON public.knowledge_packages FOR SELECT
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert knowledge packages for their projects" ON public.knowledge_packages;
CREATE POLICY "Members can insert knowledge packages"
  ON public.knowledge_packages FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can update knowledge packages for their projects" ON public.knowledge_packages;
CREATE POLICY "Members can update knowledge packages"
  ON public.knowledge_packages FOR UPDATE
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  )
  WITH CHECK (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete knowledge packages for their projects" ON public.knowledge_packages;
CREATE POLICY "Members can delete knowledge packages"
  ON public.knowledge_packages FOR DELETE
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  );


-- ----------------------------------------
-- NAMED_KNOWLEDGE_PACKAGES TABLE
-- ----------------------------------------

DROP POLICY IF EXISTS "Users can view named packages for their projects" ON public.named_knowledge_packages;
CREATE POLICY "Members can view named knowledge packages"
  ON public.named_knowledge_packages FOR SELECT
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert named packages for their projects" ON public.named_knowledge_packages;
CREATE POLICY "Members can insert named knowledge packages"
  ON public.named_knowledge_packages FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can update named packages for their projects" ON public.named_knowledge_packages;
CREATE POLICY "Members can update named knowledge packages"
  ON public.named_knowledge_packages FOR UPDATE
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  )
  WITH CHECK (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete named packages for their projects" ON public.named_knowledge_packages;
CREATE POLICY "Members can delete named knowledge packages"
  ON public.named_knowledge_packages FOR DELETE
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  );


-- ----------------------------------------
-- KNOWLEDGE_EMBEDDINGS TABLE
-- ----------------------------------------

DROP POLICY IF EXISTS "Users can view embeddings for their projects" ON public.knowledge_embeddings;
CREATE POLICY "Members can view knowledge embeddings"
  ON public.knowledge_embeddings FOR SELECT
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert embeddings for their projects" ON public.knowledge_embeddings;
CREATE POLICY "Members can insert knowledge embeddings"
  ON public.knowledge_embeddings FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can update embeddings for their projects" ON public.knowledge_embeddings;
CREATE POLICY "Members can update knowledge embeddings"
  ON public.knowledge_embeddings FOR UPDATE
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  )
  WITH CHECK (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete embeddings for their projects" ON public.knowledge_embeddings;
CREATE POLICY "Members can delete knowledge embeddings"
  ON public.knowledge_embeddings FOR DELETE
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  );


-- ----------------------------------------
-- SOURCE_CODES TABLE
-- (has user_id but is project-scoped via knowledge_sources)
-- ----------------------------------------

DROP POLICY IF EXISTS "Users can view their own source codes" ON public.source_codes;
CREATE POLICY "Members can view source codes"
  ON public.source_codes FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.knowledge_sources ks
      WHERE ks.source_code_id = source_codes.id
        AND public.user_has_project_access(ks.project_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert their own source codes" ON public.source_codes;
CREATE POLICY "Users can insert source codes"
  ON public.source_codes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own source codes" ON public.source_codes;
CREATE POLICY "Members can update source codes"
  ON public.source_codes FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.knowledge_sources ks
      WHERE ks.source_code_id = source_codes.id
        AND public.user_has_project_access(ks.project_id, auth.uid())
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.knowledge_sources ks
      WHERE ks.source_code_id = source_codes.id
        AND public.user_has_project_access(ks.project_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their own source codes" ON public.source_codes;
CREATE POLICY "Members can delete source codes"
  ON public.source_codes FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.knowledge_sources ks
      WHERE ks.source_code_id = source_codes.id
        AND public.user_has_project_access(ks.project_id, auth.uid())
    )
  );


-- ----------------------------------------
-- PROJECT_ANALYSES TABLE
-- ----------------------------------------

DROP POLICY IF EXISTS "Users can view their project analyses" ON public.project_analyses;
CREATE POLICY "Members can view project analyses"
  ON public.project_analyses FOR SELECT
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert analyses for their projects" ON public.project_analyses;
CREATE POLICY "Members can insert project analyses"
  ON public.project_analyses FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can update their project analyses" ON public.project_analyses;
CREATE POLICY "Members can update project analyses"
  ON public.project_analyses FOR UPDATE
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  )
  WITH CHECK (
    public.user_has_project_access(project_id, auth.uid())
  );


-- ----------------------------------------
-- CHAT_RUNS TABLE
-- ----------------------------------------

DROP POLICY IF EXISTS "Users can view their chat runs" ON public.chat_runs;
CREATE POLICY "Members can view chat runs"
  ON public.chat_runs FOR SELECT
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert chat runs for their projects" ON public.chat_runs;
CREATE POLICY "Members can insert chat runs"
  ON public.chat_runs FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can update their chat runs" ON public.chat_runs;
CREATE POLICY "Members can update chat runs"
  ON public.chat_runs FOR UPDATE
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  )
  WITH CHECK (
    public.user_has_project_access(project_id, auth.uid())
  );


-- ----------------------------------------
-- CUSTOM_TAGS TABLE
-- ----------------------------------------

DROP POLICY IF EXISTS "Users can view custom tags for their projects" ON public.custom_tags;
CREATE POLICY "Members can view custom tags"
  ON public.custom_tags FOR SELECT
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can create custom tags for their projects" ON public.custom_tags;
CREATE POLICY "Members can create custom tags"
  ON public.custom_tags FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can update custom tags for their projects" ON public.custom_tags;
CREATE POLICY "Members can update custom tags"
  ON public.custom_tags FOR UPDATE
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  )
  WITH CHECK (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete custom tags for their projects" ON public.custom_tags;
CREATE POLICY "Members can delete custom tags"
  ON public.custom_tags FOR DELETE
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  );


-- ----------------------------------------
-- COMPANIES TABLE
-- ----------------------------------------

DROP POLICY IF EXISTS "Users can view companies for their projects" ON public.companies;
CREATE POLICY "Members can view companies"
  ON public.companies FOR SELECT
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert companies for their projects" ON public.companies;
CREATE POLICY "Members can insert companies"
  ON public.companies FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can update companies for their projects" ON public.companies;
CREATE POLICY "Members can update companies"
  ON public.companies FOR UPDATE
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  )
  WITH CHECK (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete companies for their projects" ON public.companies;
CREATE POLICY "Members can delete companies"
  ON public.companies FOR DELETE
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  );


-- ----------------------------------------
-- CONTACTS TABLE
-- ----------------------------------------

DROP POLICY IF EXISTS "Users can view contacts for their projects" ON public.contacts;
CREATE POLICY "Members can view contacts"
  ON public.contacts FOR SELECT
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert contacts for their projects" ON public.contacts;
CREATE POLICY "Members can insert contacts"
  ON public.contacts FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can update contacts for their projects" ON public.contacts;
CREATE POLICY "Members can update contacts"
  ON public.contacts FOR UPDATE
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  )
  WITH CHECK (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete contacts for their projects" ON public.contacts;
CREATE POLICY "Members can delete contacts"
  ON public.contacts FOR DELETE
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  );


-- ----------------------------------------
-- CUSTOMER_CUSTOM_FIELD_DEFINITIONS TABLE
-- ----------------------------------------

DROP POLICY IF EXISTS "Users can view custom field definitions for their projects" ON public.customer_custom_field_definitions;
CREATE POLICY "Members can view custom field definitions"
  ON public.customer_custom_field_definitions FOR SELECT
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert custom field definitions for their projects" ON public.customer_custom_field_definitions;
CREATE POLICY "Members can insert custom field definitions"
  ON public.customer_custom_field_definitions FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can update custom field definitions for their projects" ON public.customer_custom_field_definitions;
CREATE POLICY "Members can update custom field definitions"
  ON public.customer_custom_field_definitions FOR UPDATE
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  )
  WITH CHECK (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete custom field definitions for their projects" ON public.customer_custom_field_definitions;
CREATE POLICY "Members can delete custom field definitions"
  ON public.customer_custom_field_definitions FOR DELETE
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  );


-- ----------------------------------------
-- SLACK_WORKSPACE_TOKENS TABLE
-- ----------------------------------------

DROP POLICY IF EXISTS "Project owners can view slack tokens" ON public.slack_workspace_tokens;
CREATE POLICY "Members can view slack tokens"
  ON public.slack_workspace_tokens FOR SELECT
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Project owners can insert slack tokens" ON public.slack_workspace_tokens;
CREATE POLICY "Owners can insert slack tokens"
  ON public.slack_workspace_tokens FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_project_role(project_id, auth.uid(), 'owner')
  );

DROP POLICY IF EXISTS "Project owners can delete slack tokens" ON public.slack_workspace_tokens;
CREATE POLICY "Owners can delete slack tokens"
  ON public.slack_workspace_tokens FOR DELETE
  TO authenticated
  USING (
    public.user_has_project_role(project_id, auth.uid(), 'owner')
  );


-- ----------------------------------------
-- SLACK_CHANNELS TABLE
-- ----------------------------------------

DROP POLICY IF EXISTS "Users can view slack channels" ON public.slack_channels;
CREATE POLICY "Members can view slack channels"
  ON public.slack_channels FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.slack_workspace_tokens swt
      WHERE swt.id = slack_channels.workspace_token_id
        AND public.user_has_project_access(swt.project_id, auth.uid())
    )
  );


-- ----------------------------------------
-- SLACK_THREAD_SESSIONS TABLE
-- ----------------------------------------

DROP POLICY IF EXISTS "Users can view slack thread sessions" ON public.slack_thread_sessions;
CREATE POLICY "Members can view slack thread sessions"
  ON public.slack_thread_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.slack_channels sc
      JOIN public.slack_workspace_tokens swt ON swt.id = sc.workspace_token_id
      WHERE sc.id = slack_thread_sessions.channel_id
        AND public.user_has_project_access(swt.project_id, auth.uid())
    )
  );


-- ----------------------------------------
-- GITHUB_APP_INSTALLATIONS TABLE
-- ----------------------------------------

DROP POLICY IF EXISTS "Project owners can view github tokens" ON public.github_app_installations;
CREATE POLICY "Members can view github installations"
  ON public.github_app_installations FOR SELECT
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Project owners can insert github tokens" ON public.github_app_installations;
CREATE POLICY "Owners can insert github installations"
  ON public.github_app_installations FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_project_role(project_id, auth.uid(), 'owner')
  );

DROP POLICY IF EXISTS "Project owners can delete github tokens" ON public.github_app_installations;
CREATE POLICY "Owners can delete github installations"
  ON public.github_app_installations FOR DELETE
  TO authenticated
  USING (
    public.user_has_project_role(project_id, auth.uid(), 'owner')
  );


-- ----------------------------------------
-- GONG_CONNECTIONS TABLE
-- ----------------------------------------

DROP POLICY IF EXISTS "Users can view their Gong connections" ON public.gong_connections;
CREATE POLICY "Members can view Gong connections"
  ON public.gong_connections FOR SELECT
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert Gong connections for their projects" ON public.gong_connections;
CREATE POLICY "Members can insert Gong connections"
  ON public.gong_connections FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can update their Gong connections" ON public.gong_connections;
CREATE POLICY "Members can update Gong connections"
  ON public.gong_connections FOR UPDATE
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  )
  WITH CHECK (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete their Gong connections" ON public.gong_connections;
CREATE POLICY "Members can delete Gong connections"
  ON public.gong_connections FOR DELETE
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  );


-- ----------------------------------------
-- GONG_SYNCED_CALLS TABLE
-- ----------------------------------------

DROP POLICY IF EXISTS "Users can view their synced calls" ON public.gong_synced_calls;
CREATE POLICY "Members can view Gong synced calls"
  ON public.gong_synced_calls FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gong_connections gc
      WHERE gc.id = gong_synced_calls.connection_id
        AND public.user_has_project_access(gc.project_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert synced calls for their connections" ON public.gong_synced_calls;
CREATE POLICY "Members can insert Gong synced calls"
  ON public.gong_synced_calls FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.gong_connections gc
      WHERE gc.id = gong_synced_calls.connection_id
        AND public.user_has_project_access(gc.project_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their synced calls" ON public.gong_synced_calls;
CREATE POLICY "Members can delete Gong synced calls"
  ON public.gong_synced_calls FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gong_connections gc
      WHERE gc.id = gong_synced_calls.connection_id
        AND public.user_has_project_access(gc.project_id, auth.uid())
    )
  );


-- ----------------------------------------
-- GONG_SYNC_RUNS TABLE
-- ----------------------------------------

DROP POLICY IF EXISTS "Users can view their Gong sync runs" ON public.gong_sync_runs;
CREATE POLICY "Members can view Gong sync runs"
  ON public.gong_sync_runs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gong_connections gc
      WHERE gc.id = gong_sync_runs.connection_id
        AND public.user_has_project_access(gc.project_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert Gong sync runs for their connections" ON public.gong_sync_runs;
CREATE POLICY "Members can insert Gong sync runs"
  ON public.gong_sync_runs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.gong_connections gc
      WHERE gc.id = gong_sync_runs.connection_id
        AND public.user_has_project_access(gc.project_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their Gong sync runs" ON public.gong_sync_runs;
CREATE POLICY "Members can update Gong sync runs"
  ON public.gong_sync_runs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gong_connections gc
      WHERE gc.id = gong_sync_runs.connection_id
        AND public.user_has_project_access(gc.project_id, auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.gong_connections gc
      WHERE gc.id = gong_sync_runs.connection_id
        AND public.user_has_project_access(gc.project_id, auth.uid())
    )
  );


-- ----------------------------------------
-- INTERCOM (all 3 tables)
-- ----------------------------------------

-- intercom_connections
DROP POLICY IF EXISTS "Users can view their Intercom connections" ON public.intercom_connections;
CREATE POLICY "Members can view Intercom connections"
  ON public.intercom_connections FOR SELECT
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert Intercom connections for their projects" ON public.intercom_connections;
CREATE POLICY "Members can insert Intercom connections"
  ON public.intercom_connections FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can update their Intercom connections" ON public.intercom_connections;
CREATE POLICY "Members can update Intercom connections"
  ON public.intercom_connections FOR UPDATE
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  )
  WITH CHECK (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete their Intercom connections" ON public.intercom_connections;
CREATE POLICY "Members can delete Intercom connections"
  ON public.intercom_connections FOR DELETE
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  );

-- intercom_synced_conversations
DROP POLICY IF EXISTS "Users can view their synced conversations" ON public.intercom_synced_conversations;
CREATE POLICY "Members can view Intercom synced conversations"
  ON public.intercom_synced_conversations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.intercom_connections ic
      WHERE ic.id = intercom_synced_conversations.connection_id
        AND public.user_has_project_access(ic.project_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert synced conversations for their connections" ON public.intercom_synced_conversations;
CREATE POLICY "Members can insert Intercom synced conversations"
  ON public.intercom_synced_conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.intercom_connections ic
      WHERE ic.id = intercom_synced_conversations.connection_id
        AND public.user_has_project_access(ic.project_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their synced conversations" ON public.intercom_synced_conversations;
CREATE POLICY "Members can delete Intercom synced conversations"
  ON public.intercom_synced_conversations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.intercom_connections ic
      WHERE ic.id = intercom_synced_conversations.connection_id
        AND public.user_has_project_access(ic.project_id, auth.uid())
    )
  );

-- intercom_sync_runs
DROP POLICY IF EXISTS "Users can view their sync runs" ON public.intercom_sync_runs;
CREATE POLICY "Members can view Intercom sync runs"
  ON public.intercom_sync_runs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.intercom_connections ic
      WHERE ic.id = intercom_sync_runs.connection_id
        AND public.user_has_project_access(ic.project_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert sync runs for their connections" ON public.intercom_sync_runs;
CREATE POLICY "Members can insert Intercom sync runs"
  ON public.intercom_sync_runs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.intercom_connections ic
      WHERE ic.id = intercom_sync_runs.connection_id
        AND public.user_has_project_access(ic.project_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their sync runs" ON public.intercom_sync_runs;
CREATE POLICY "Members can update Intercom sync runs"
  ON public.intercom_sync_runs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.intercom_connections ic
      WHERE ic.id = intercom_sync_runs.connection_id
        AND public.user_has_project_access(ic.project_id, auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.intercom_connections ic
      WHERE ic.id = intercom_sync_runs.connection_id
        AND public.user_has_project_access(ic.project_id, auth.uid())
    )
  );


-- ----------------------------------------
-- JIRA (2 tables)
-- ----------------------------------------

-- jira_connections
DROP POLICY IF EXISTS "Users can view their Jira connections" ON public.jira_connections;
CREATE POLICY "Members can view Jira connections"
  ON public.jira_connections FOR SELECT
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert Jira connections for their projects" ON public.jira_connections;
CREATE POLICY "Members can insert Jira connections"
  ON public.jira_connections FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can update their Jira connections" ON public.jira_connections;
CREATE POLICY "Members can update Jira connections"
  ON public.jira_connections FOR UPDATE
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  )
  WITH CHECK (
    public.user_has_project_access(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete their Jira connections" ON public.jira_connections;
CREATE POLICY "Members can delete Jira connections"
  ON public.jira_connections FOR DELETE
  TO authenticated
  USING (
    public.user_has_project_access(project_id, auth.uid())
  );

-- jira_issue_syncs
DROP POLICY IF EXISTS "Users can view their Jira issue syncs" ON public.jira_issue_syncs;
CREATE POLICY "Members can view Jira issue syncs"
  ON public.jira_issue_syncs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.jira_connections jc
      WHERE jc.id = jira_issue_syncs.connection_id
        AND public.user_has_project_access(jc.project_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert Jira issue syncs for their connections" ON public.jira_issue_syncs;
CREATE POLICY "Members can insert Jira issue syncs"
  ON public.jira_issue_syncs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.jira_connections jc
      WHERE jc.id = jira_issue_syncs.connection_id
        AND public.user_has_project_access(jc.project_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their Jira issue syncs" ON public.jira_issue_syncs;
CREATE POLICY "Members can update Jira issue syncs"
  ON public.jira_issue_syncs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.jira_connections jc
      WHERE jc.id = jira_issue_syncs.connection_id
        AND public.user_has_project_access(jc.project_id, auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.jira_connections jc
      WHERE jc.id = jira_issue_syncs.connection_id
        AND public.user_has_project_access(jc.project_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their Jira issue syncs" ON public.jira_issue_syncs;
CREATE POLICY "Members can delete Jira issue syncs"
  ON public.jira_issue_syncs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.jira_connections jc
      WHERE jc.id = jira_issue_syncs.connection_id
        AND public.user_has_project_access(jc.project_id, auth.uid())
    )
  );


-- ----------------------------------------
-- STORAGE BUCKET POLICIES (M4 fix)
-- ----------------------------------------

-- Knowledge bucket
DROP POLICY IF EXISTS "Users can read knowledge for their projects" ON storage.objects;
CREATE POLICY "Members can read knowledge for their projects"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'knowledge' AND
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id::text = (storage.foldername(objects.name))[1]
        AND pm.user_id = auth.uid()
        AND pm.status = 'active'
    )
  );

-- Documents bucket
DROP POLICY IF EXISTS "Users can upload documents to their projects" ON storage.objects;
CREATE POLICY "Members can upload documents to their projects"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents' AND
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id::text = (storage.foldername(objects.name))[1]
        AND pm.user_id = auth.uid()
        AND pm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users can read documents from their projects" ON storage.objects;
CREATE POLICY "Members can read documents from their projects"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents' AND
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id::text = (storage.foldername(objects.name))[1]
        AND pm.user_id = auth.uid()
        AND pm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users can delete documents from their projects" ON storage.objects;
CREATE POLICY "Members can delete documents from their projects"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents' AND
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id::text = (storage.foldername(objects.name))[1]
        AND pm.user_id = auth.uid()
        AND pm.status = 'active'
    )
  );

-- Codebase bucket (if exists)
DROP POLICY IF EXISTS "Users can upload to their folder" ON storage.objects;
CREATE POLICY "Members can upload codebase files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'codebase' AND
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id::text = (storage.foldername(objects.name))[1]
        AND pm.user_id = auth.uid()
        AND pm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users can read their files" ON storage.objects;
CREATE POLICY "Members can read codebase files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'codebase' AND
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id::text = (storage.foldername(objects.name))[1]
        AND pm.user_id = auth.uid()
        AND pm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users can delete their files" ON storage.objects;
CREATE POLICY "Members can delete codebase files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'codebase' AND
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id::text = (storage.foldername(objects.name))[1]
        AND pm.user_id = auth.uid()
        AND pm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users can update their files" ON storage.objects;
CREATE POLICY "Members can update codebase files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'codebase' AND
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id::text = (storage.foldername(objects.name))[1]
        AND pm.user_id = auth.uid()
        AND pm.status = 'active'
    )
  )
  WITH CHECK (
    bucket_id = 'codebase' AND
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id::text = (storage.foldername(objects.name))[1]
        AND pm.user_id = auth.uid()
        AND pm.status = 'active'
    )
  );
