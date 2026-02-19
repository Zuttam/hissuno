-- Add Zendesk integration tables for syncing tickets
-- This allows users to connect their Zendesk account via API token
-- and sync solved/closed tickets into Hissuno sessions

-- 1. Zendesk connections - stores credentials and sync config
CREATE TABLE IF NOT EXISTS public.zendesk_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  -- Credentials
  subdomain text NOT NULL,
  admin_email text NOT NULL,
  api_token text NOT NULL,

  -- Account info (fetched via /users/me endpoint)
  account_name text,

  -- Sync configuration
  sync_frequency text NOT NULL DEFAULT 'manual' CHECK (sync_frequency IN ('manual', '1h', '6h', '24h')),
  sync_enabled boolean NOT NULL DEFAULT true,
  filter_config jsonb DEFAULT '{}',  -- { fromDate: ISO string, toDate: ISO string }

  -- Sync state tracking
  last_sync_at timestamptz,
  last_sync_status text CHECK (last_sync_status IN ('success', 'error', 'in_progress')),
  last_sync_error text,
  last_sync_tickets_count integer DEFAULT 0,
  next_sync_at timestamptz,

  -- Metadata
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),

  -- Ensure one connection per project
  UNIQUE(project_id)
);

ALTER TABLE public.zendesk_connections OWNER TO postgres;

COMMENT ON TABLE public.zendesk_connections IS 'Stores Zendesk API credentials and sync configuration per project.';
COMMENT ON COLUMN public.zendesk_connections.api_token IS 'Zendesk API token.';
COMMENT ON COLUMN public.zendesk_connections.filter_config IS 'Optional date range filter for syncing: { fromDate, toDate }.';

-- Indexes
CREATE INDEX IF NOT EXISTS zendesk_connections_project_id_idx
  ON public.zendesk_connections(project_id);
CREATE INDEX IF NOT EXISTS zendesk_connections_next_sync_idx
  ON public.zendesk_connections(next_sync_at)
  WHERE sync_enabled = true AND sync_frequency != 'manual';

-- 2. Zendesk synced tickets - tracks which tickets have been synced
CREATE TABLE IF NOT EXISTS public.zendesk_synced_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.zendesk_connections(id) ON DELETE CASCADE,

  -- Zendesk ticket reference
  zendesk_ticket_id bigint NOT NULL,

  -- Hissuno session reference
  session_id text NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,

  -- Sync metadata
  ticket_created_at timestamptz,  -- Original Zendesk timestamp
  ticket_updated_at timestamptz,  -- For future delta sync support
  comments_count integer DEFAULT 0,

  synced_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),

  -- Prevent duplicate syncs
  UNIQUE(connection_id, zendesk_ticket_id)
);

ALTER TABLE public.zendesk_synced_tickets OWNER TO postgres;

COMMENT ON TABLE public.zendesk_synced_tickets IS 'Tracks synced Zendesk tickets to prevent duplicates.';

-- Indexes
CREATE INDEX IF NOT EXISTS zendesk_synced_tickets_connection_idx
  ON public.zendesk_synced_tickets(connection_id);
CREATE INDEX IF NOT EXISTS zendesk_synced_tickets_session_idx
  ON public.zendesk_synced_tickets(session_id);
CREATE INDEX IF NOT EXISTS zendesk_synced_tickets_zendesk_id_idx
  ON public.zendesk_synced_tickets(zendesk_ticket_id);

-- 3. Zendesk sync runs - history of sync operations for debugging
CREATE TABLE IF NOT EXISTS public.zendesk_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.zendesk_connections(id) ON DELETE CASCADE,

  -- Run metadata
  triggered_by text NOT NULL CHECK (triggered_by IN ('manual', 'cron')),
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'success', 'error')),

  -- Results
  tickets_found integer DEFAULT 0,
  tickets_synced integer DEFAULT 0,
  tickets_skipped integer DEFAULT 0,
  error_message text,

  -- Timing
  started_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  completed_at timestamptz
);

ALTER TABLE public.zendesk_sync_runs OWNER TO postgres;

COMMENT ON TABLE public.zendesk_sync_runs IS 'Sync run history for debugging and monitoring.';

-- Indexes
CREATE INDEX IF NOT EXISTS zendesk_sync_runs_connection_idx
  ON public.zendesk_sync_runs(connection_id);
CREATE INDEX IF NOT EXISTS zendesk_sync_runs_started_at_idx
  ON public.zendesk_sync_runs(started_at DESC);

-- Enable RLS on all tables
ALTER TABLE public.zendesk_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zendesk_synced_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zendesk_sync_runs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for zendesk_connections
CREATE POLICY "Users can view their Zendesk connections"
ON public.zendesk_connections FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = zendesk_connections.project_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert Zendesk connections for their projects"
ON public.zendesk_connections FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = zendesk_connections.project_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their Zendesk connections"
ON public.zendesk_connections FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = zendesk_connections.project_id
    AND projects.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = zendesk_connections.project_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their Zendesk connections"
ON public.zendesk_connections FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = zendesk_connections.project_id
    AND projects.user_id = auth.uid()
  )
);

-- RLS Policies for zendesk_synced_tickets
CREATE POLICY "Users can view their synced tickets"
ON public.zendesk_synced_tickets FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.zendesk_connections zc
    JOIN public.projects p ON p.id = zc.project_id
    WHERE zc.id = zendesk_synced_tickets.connection_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert synced tickets for their connections"
ON public.zendesk_synced_tickets FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.zendesk_connections zc
    JOIN public.projects p ON p.id = zc.project_id
    WHERE zc.id = zendesk_synced_tickets.connection_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their synced tickets"
ON public.zendesk_synced_tickets FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.zendesk_connections zc
    JOIN public.projects p ON p.id = zc.project_id
    WHERE zc.id = zendesk_synced_tickets.connection_id
    AND p.user_id = auth.uid()
  )
);

-- RLS Policies for zendesk_sync_runs
CREATE POLICY "Users can view their Zendesk sync runs"
ON public.zendesk_sync_runs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.zendesk_connections zc
    JOIN public.projects p ON p.id = zc.project_id
    WHERE zc.id = zendesk_sync_runs.connection_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert Zendesk sync runs for their connections"
ON public.zendesk_sync_runs FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.zendesk_connections zc
    JOIN public.projects p ON p.id = zc.project_id
    WHERE zc.id = zendesk_sync_runs.connection_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their Zendesk sync runs"
ON public.zendesk_sync_runs FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.zendesk_connections zc
    JOIN public.projects p ON p.id = zc.project_id
    WHERE zc.id = zendesk_sync_runs.connection_id
    AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.zendesk_connections zc
    JOIN public.projects p ON p.id = zc.project_id
    WHERE zc.id = zendesk_sync_runs.connection_id
    AND p.user_id = auth.uid()
  )
);

-- Trigger for updated_at on zendesk_connections
CREATE TRIGGER handle_zendesk_connections_updated_at
  BEFORE UPDATE ON public.zendesk_connections
  FOR EACH ROW
  EXECUTE PROCEDURE extensions.moddatetime(updated_at);
