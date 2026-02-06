-- Add Jira integration tables for syncing issues to Jira
-- This allows users to connect their Jira workspace via OAuth 2.0 (3LO)
-- and automatically create/update Jira tickets from Hissuno issues

-- 1. Jira connections - stores OAuth credentials and project configuration
CREATE TABLE IF NOT EXISTS public.jira_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  -- OAuth credentials
  cloud_id text NOT NULL,
  site_url text NOT NULL,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expires_at timestamptz NOT NULL,

  -- Configuration (NULL until user selects Jira project)
  jira_project_key text,
  jira_project_id text,
  issue_type_id text,
  issue_type_name text,
  is_enabled boolean NOT NULL DEFAULT true,

  -- Metadata
  installed_by_user_id uuid REFERENCES auth.users(id),
  installed_by_email text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),

  -- Webhook configuration
  webhook_id text,
  webhook_secret text,

  -- Ensure one connection per project
  UNIQUE(project_id)
);

ALTER TABLE public.jira_connections OWNER TO postgres;

COMMENT ON TABLE public.jira_connections IS 'Stores Jira OAuth credentials and project configuration per Hissuno project.';
COMMENT ON COLUMN public.jira_connections.cloud_id IS 'Jira Cloud site identifier from accessible-resources API.';
COMMENT ON COLUMN public.jira_connections.site_url IS 'Jira site URL, e.g., https://yoursite.atlassian.net';
COMMENT ON COLUMN public.jira_connections.jira_project_key IS 'Target Jira project key, e.g., HISS';

-- Indexes
CREATE INDEX IF NOT EXISTS jira_connections_project_id_idx
  ON public.jira_connections(project_id);

-- 2. Jira issue syncs - tracks which Hissuno issues have been synced to Jira
CREATE TABLE IF NOT EXISTS public.jira_issue_syncs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.jira_connections(id) ON DELETE CASCADE,

  -- Jira ticket reference
  jira_issue_key text,
  jira_issue_id text,
  jira_issue_url text,

  -- Sync tracking (outbound: Hissuno -> Jira)
  last_sync_action text,
  last_sync_status text NOT NULL DEFAULT 'pending' CHECK (last_sync_status IN ('pending', 'success', 'failed')),
  last_sync_error text,
  retry_count integer NOT NULL DEFAULT 0,
  last_synced_at timestamptz,

  -- Webhook tracking (inbound: Jira -> Hissuno)
  last_jira_status text,
  last_webhook_received_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),

  -- One sync record per issue
  UNIQUE(issue_id)
);

ALTER TABLE public.jira_issue_syncs OWNER TO postgres;

COMMENT ON TABLE public.jira_issue_syncs IS 'Tracks synced Hissuno issues to Jira tickets.';

-- Indexes for webhook lookups
CREATE INDEX IF NOT EXISTS jira_issue_syncs_jira_issue_key_idx
  ON public.jira_issue_syncs(jira_issue_key);
CREATE INDEX IF NOT EXISTS jira_issue_syncs_jira_issue_id_idx
  ON public.jira_issue_syncs(jira_issue_id);
CREATE INDEX IF NOT EXISTS jira_issue_syncs_connection_id_idx
  ON public.jira_issue_syncs(connection_id);
CREATE INDEX IF NOT EXISTS jira_issue_syncs_last_sync_status_idx
  ON public.jira_issue_syncs(last_sync_status)
  WHERE last_sync_status = 'failed' AND retry_count < 3;

-- Enable RLS on all tables
ALTER TABLE public.jira_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jira_issue_syncs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for jira_connections
CREATE POLICY "Users can view their Jira connections"
ON public.jira_connections FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = jira_connections.project_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert Jira connections for their projects"
ON public.jira_connections FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = jira_connections.project_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their Jira connections"
ON public.jira_connections FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = jira_connections.project_id
    AND projects.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = jira_connections.project_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their Jira connections"
ON public.jira_connections FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = jira_connections.project_id
    AND projects.user_id = auth.uid()
  )
);

-- RLS Policies for jira_issue_syncs
CREATE POLICY "Users can view their Jira issue syncs"
ON public.jira_issue_syncs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jira_connections jc
    JOIN public.projects p ON p.id = jc.project_id
    WHERE jc.id = jira_issue_syncs.connection_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert Jira issue syncs for their connections"
ON public.jira_issue_syncs FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.jira_connections jc
    JOIN public.projects p ON p.id = jc.project_id
    WHERE jc.id = jira_issue_syncs.connection_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their Jira issue syncs"
ON public.jira_issue_syncs FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jira_connections jc
    JOIN public.projects p ON p.id = jc.project_id
    WHERE jc.id = jira_issue_syncs.connection_id
    AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.jira_connections jc
    JOIN public.projects p ON p.id = jc.project_id
    WHERE jc.id = jira_issue_syncs.connection_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their Jira issue syncs"
ON public.jira_issue_syncs FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jira_connections jc
    JOIN public.projects p ON p.id = jc.project_id
    WHERE jc.id = jira_issue_syncs.connection_id
    AND p.user_id = auth.uid()
  )
);

-- Trigger for updated_at on jira_connections
CREATE TRIGGER handle_jira_connections_updated_at
  BEFORE UPDATE ON public.jira_connections
  FOR EACH ROW
  EXECUTE PROCEDURE extensions.moddatetime(updated_at);
