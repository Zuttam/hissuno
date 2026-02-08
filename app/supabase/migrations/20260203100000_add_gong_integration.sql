-- Add Gong integration tables for syncing call transcripts
-- This allows users to connect their Gong workspace via API key
-- and sync call transcriptions into Hissuno sessions

-- 1. Gong connections - stores API credentials and sync config
CREATE TABLE IF NOT EXISTS public.gong_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  -- Credentials (Basic Auth: access_key:access_key_secret)
  base_url text NOT NULL DEFAULT 'https://api.gong.io',
  access_key text NOT NULL,
  access_key_secret text NOT NULL,

  -- Sync configuration
  sync_frequency text NOT NULL DEFAULT 'manual' CHECK (sync_frequency IN ('manual', '1h', '6h', '24h')),
  sync_enabled boolean NOT NULL DEFAULT true,
  filter_config jsonb DEFAULT '{}',  -- { fromDate: ISO string, toDate: ISO string }

  -- Sync state tracking
  last_sync_at timestamptz,
  last_sync_status text CHECK (last_sync_status IN ('success', 'error', 'in_progress')),
  last_sync_error text,
  last_sync_calls_count integer DEFAULT 0,
  next_sync_at timestamptz,

  -- Metadata
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),

  -- Ensure one connection per project
  UNIQUE(project_id)
);

ALTER TABLE public.gong_connections OWNER TO postgres;

COMMENT ON TABLE public.gong_connections IS 'Stores Gong API credentials and sync configuration per project.';
COMMENT ON COLUMN public.gong_connections.access_key IS 'Gong API access key.';
COMMENT ON COLUMN public.gong_connections.access_key_secret IS 'Gong API access key secret.';
COMMENT ON COLUMN public.gong_connections.filter_config IS 'Optional date range filter for syncing: { fromDate, toDate }.';

-- Indexes
CREATE INDEX IF NOT EXISTS gong_connections_project_id_idx
  ON public.gong_connections(project_id);
CREATE INDEX IF NOT EXISTS gong_connections_next_sync_idx
  ON public.gong_connections(next_sync_at)
  WHERE sync_enabled = true AND sync_frequency != 'manual';

-- 2. Gong synced calls - tracks which calls have been synced
CREATE TABLE IF NOT EXISTS public.gong_synced_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.gong_connections(id) ON DELETE CASCADE,

  -- Gong call reference
  gong_call_id text NOT NULL,

  -- Hissuno session reference
  session_id text NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,

  -- Sync metadata
  call_created_at timestamptz,  -- Original Gong timestamp
  call_duration_seconds integer,
  messages_count integer DEFAULT 0,

  synced_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),

  -- Prevent duplicate syncs
  UNIQUE(connection_id, gong_call_id)
);

ALTER TABLE public.gong_synced_calls OWNER TO postgres;

COMMENT ON TABLE public.gong_synced_calls IS 'Tracks synced Gong calls to prevent duplicates.';

-- Indexes
CREATE INDEX IF NOT EXISTS gong_synced_calls_connection_idx
  ON public.gong_synced_calls(connection_id);
CREATE INDEX IF NOT EXISTS gong_synced_calls_session_idx
  ON public.gong_synced_calls(session_id);
CREATE INDEX IF NOT EXISTS gong_synced_calls_gong_id_idx
  ON public.gong_synced_calls(gong_call_id);

-- 3. Gong sync runs - history of sync operations for debugging
CREATE TABLE IF NOT EXISTS public.gong_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.gong_connections(id) ON DELETE CASCADE,

  -- Run metadata
  triggered_by text NOT NULL CHECK (triggered_by IN ('manual', 'cron')),
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'success', 'error')),

  -- Results
  calls_found integer DEFAULT 0,
  calls_synced integer DEFAULT 0,
  calls_skipped integer DEFAULT 0,
  error_message text,

  -- Timing
  started_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  completed_at timestamptz
);

ALTER TABLE public.gong_sync_runs OWNER TO postgres;

COMMENT ON TABLE public.gong_sync_runs IS 'Sync run history for debugging and monitoring.';

-- Indexes
CREATE INDEX IF NOT EXISTS gong_sync_runs_connection_idx
  ON public.gong_sync_runs(connection_id);
CREATE INDEX IF NOT EXISTS gong_sync_runs_started_at_idx
  ON public.gong_sync_runs(started_at DESC);

-- Enable RLS on all tables
ALTER TABLE public.gong_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gong_synced_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gong_sync_runs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for gong_connections
CREATE POLICY "Users can view their Gong connections"
ON public.gong_connections FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = gong_connections.project_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert Gong connections for their projects"
ON public.gong_connections FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = gong_connections.project_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their Gong connections"
ON public.gong_connections FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = gong_connections.project_id
    AND projects.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = gong_connections.project_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their Gong connections"
ON public.gong_connections FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = gong_connections.project_id
    AND projects.user_id = auth.uid()
  )
);

-- RLS Policies for gong_synced_calls
CREATE POLICY "Users can view their synced calls"
ON public.gong_synced_calls FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.gong_connections gc
    JOIN public.projects p ON p.id = gc.project_id
    WHERE gc.id = gong_synced_calls.connection_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert synced calls for their connections"
ON public.gong_synced_calls FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.gong_connections gc
    JOIN public.projects p ON p.id = gc.project_id
    WHERE gc.id = gong_synced_calls.connection_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their synced calls"
ON public.gong_synced_calls FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.gong_connections gc
    JOIN public.projects p ON p.id = gc.project_id
    WHERE gc.id = gong_synced_calls.connection_id
    AND p.user_id = auth.uid()
  )
);

-- RLS Policies for gong_sync_runs
CREATE POLICY "Users can view their Gong sync runs"
ON public.gong_sync_runs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.gong_connections gc
    JOIN public.projects p ON p.id = gc.project_id
    WHERE gc.id = gong_sync_runs.connection_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert Gong sync runs for their connections"
ON public.gong_sync_runs FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.gong_connections gc
    JOIN public.projects p ON p.id = gc.project_id
    WHERE gc.id = gong_sync_runs.connection_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their Gong sync runs"
ON public.gong_sync_runs FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.gong_connections gc
    JOIN public.projects p ON p.id = gc.project_id
    WHERE gc.id = gong_sync_runs.connection_id
    AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.gong_connections gc
    JOIN public.projects p ON p.id = gc.project_id
    WHERE gc.id = gong_sync_runs.connection_id
    AND p.user_id = auth.uid()
  )
);

-- Trigger for updated_at on gong_connections
CREATE TRIGGER handle_gong_connections_updated_at
  BEFORE UPDATE ON public.gong_connections
  FOR EACH ROW
  EXECUTE PROCEDURE extensions.moddatetime(updated_at);
