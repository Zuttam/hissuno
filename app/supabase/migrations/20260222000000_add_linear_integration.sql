-- Add Linear integration tables for syncing issues to Linear
-- Also adds auto_sync_enabled column to jira_connections for feature parity

-- 1. Add auto_sync_enabled to jira_connections (defaults true for backward compat)
ALTER TABLE public.jira_connections
  ADD COLUMN IF NOT EXISTS auto_sync_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.jira_connections.auto_sync_enabled IS 'Whether new issues auto-sync to Jira. Default true for backward compat.';

-- 2. Linear connections - stores OAuth credentials and team configuration
CREATE TABLE IF NOT EXISTS public.linear_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  -- OAuth credentials
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expires_at timestamptz NOT NULL,

  -- Organization info (from OAuth)
  organization_id text NOT NULL,
  organization_name text NOT NULL,

  -- Configuration (NULL until user selects team)
  team_id text,
  team_name text,
  team_key text,
  is_enabled boolean NOT NULL DEFAULT true,
  auto_sync_enabled boolean NOT NULL DEFAULT true,

  -- Metadata
  installed_by_user_id uuid REFERENCES auth.users(id),
  installed_by_email text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),

  -- Ensure one connection per project
  UNIQUE(project_id)
);

ALTER TABLE public.linear_connections OWNER TO postgres;

COMMENT ON TABLE public.linear_connections IS 'Stores Linear OAuth credentials and team configuration per Hissuno project.';
COMMENT ON COLUMN public.linear_connections.organization_id IS 'Linear organization ID from OAuth viewer query.';
COMMENT ON COLUMN public.linear_connections.team_id IS 'Target Linear team ID for issue creation.';
COMMENT ON COLUMN public.linear_connections.team_key IS 'Target Linear team key, e.g., ENG';

-- Indexes
CREATE INDEX IF NOT EXISTS linear_connections_project_id_idx
  ON public.linear_connections(project_id);

-- 3. Linear issue syncs - tracks which Hissuno issues have been synced to Linear
CREATE TABLE IF NOT EXISTS public.linear_issue_syncs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.linear_connections(id) ON DELETE CASCADE,

  -- Linear issue reference
  linear_issue_id text,
  linear_issue_identifier text,  -- e.g., "ENG-123"
  linear_issue_url text,

  -- Sync tracking (outbound: Hissuno -> Linear)
  last_sync_action text,
  last_sync_status text NOT NULL DEFAULT 'pending' CHECK (last_sync_status IN ('pending', 'success', 'failed')),
  last_sync_error text,
  retry_count integer NOT NULL DEFAULT 0,
  last_synced_at timestamptz,

  -- Webhook tracking (inbound: Linear -> Hissuno)
  last_linear_state text,
  last_linear_state_type text,  -- 'backlog'|'unstarted'|'started'|'completed'|'canceled'
  last_webhook_received_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),

  -- One sync record per issue
  UNIQUE(issue_id)
);

ALTER TABLE public.linear_issue_syncs OWNER TO postgres;

COMMENT ON TABLE public.linear_issue_syncs IS 'Tracks synced Hissuno issues to Linear issues.';

-- Indexes for webhook lookups
CREATE INDEX IF NOT EXISTS linear_issue_syncs_linear_issue_id_idx
  ON public.linear_issue_syncs(linear_issue_id);
CREATE INDEX IF NOT EXISTS linear_issue_syncs_connection_id_idx
  ON public.linear_issue_syncs(connection_id);
CREATE INDEX IF NOT EXISTS linear_issue_syncs_last_sync_status_idx
  ON public.linear_issue_syncs(last_sync_status)
  WHERE last_sync_status = 'failed' AND retry_count < 3;

-- Enable RLS on all tables
ALTER TABLE public.linear_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linear_issue_syncs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for linear_connections
CREATE POLICY "Users can view their Linear connections"
ON public.linear_connections FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = linear_connections.project_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert Linear connections for their projects"
ON public.linear_connections FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = linear_connections.project_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their Linear connections"
ON public.linear_connections FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = linear_connections.project_id
    AND projects.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = linear_connections.project_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their Linear connections"
ON public.linear_connections FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = linear_connections.project_id
    AND projects.user_id = auth.uid()
  )
);

-- RLS Policies for linear_issue_syncs
CREATE POLICY "Users can view their Linear issue syncs"
ON public.linear_issue_syncs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.linear_connections lc
    JOIN public.projects p ON p.id = lc.project_id
    WHERE lc.id = linear_issue_syncs.connection_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert Linear issue syncs for their connections"
ON public.linear_issue_syncs FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.linear_connections lc
    JOIN public.projects p ON p.id = lc.project_id
    WHERE lc.id = linear_issue_syncs.connection_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their Linear issue syncs"
ON public.linear_issue_syncs FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.linear_connections lc
    JOIN public.projects p ON p.id = lc.project_id
    WHERE lc.id = linear_issue_syncs.connection_id
    AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.linear_connections lc
    JOIN public.projects p ON p.id = lc.project_id
    WHERE lc.id = linear_issue_syncs.connection_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their Linear issue syncs"
ON public.linear_issue_syncs FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.linear_connections lc
    JOIN public.projects p ON p.id = lc.project_id
    WHERE lc.id = linear_issue_syncs.connection_id
    AND p.user_id = auth.uid()
  )
);

-- Trigger for updated_at on linear_connections
CREATE TRIGGER handle_linear_connections_updated_at
  BEFORE UPDATE ON public.linear_connections
  FOR EACH ROW
  EXECUTE PROCEDURE extensions.moddatetime(updated_at);
