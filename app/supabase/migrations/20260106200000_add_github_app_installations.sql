-- GitHub OAuth tokens for project-level repository access
-- 1:1 mapping between project and GitHub account

CREATE TABLE public.github_app_installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  account_login text NOT NULL,
  account_id bigint NOT NULL,
  installed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  installed_by_email text,
  scope text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(project_id)
);

-- Enable RLS
ALTER TABLE public.github_app_installations ENABLE ROW LEVEL SECURITY;

-- Policy: Project owners can view their tokens
CREATE POLICY "Project owners can view github tokens"
  ON public.github_app_installations
  FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

-- Policy: Project owners can insert tokens
CREATE POLICY "Project owners can insert github tokens"
  ON public.github_app_installations
  FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

-- Policy: Project owners can delete tokens
CREATE POLICY "Project owners can delete github tokens"
  ON public.github_app_installations
  FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

-- Index for project lookup
CREATE INDEX idx_github_tokens_project_id ON public.github_app_installations(project_id);
