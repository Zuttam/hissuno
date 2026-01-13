-- Slack workspace tokens for OAuth integration
-- 1:1 mapping between project and Slack workspace

CREATE TABLE public.slack_workspace_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  workspace_id text NOT NULL,
  workspace_name text,
  workspace_domain text,
  bot_token text NOT NULL,
  bot_user_id text NOT NULL,
  installed_by_user_id text,
  installed_by_email text,
  scope text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(project_id),
  UNIQUE(workspace_id)
);

-- Enable RLS
ALTER TABLE public.slack_workspace_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Project owners can view their workspace tokens
CREATE POLICY "Project owners can view slack tokens"
  ON public.slack_workspace_tokens
  FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

-- Policy: Project owners can insert slack tokens
CREATE POLICY "Project owners can insert slack tokens"
  ON public.slack_workspace_tokens
  FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

-- Policy: Project owners can delete slack tokens
CREATE POLICY "Project owners can delete slack tokens"
  ON public.slack_workspace_tokens
  FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

-- Index for workspace lookup
CREATE INDEX idx_slack_workspace_tokens_workspace_id ON public.slack_workspace_tokens(workspace_id);
