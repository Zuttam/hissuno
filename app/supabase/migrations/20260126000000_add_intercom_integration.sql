-- Add Intercom integration tables for syncing conversations
-- This allows users to connect their Intercom workspace via API token
-- and sync conversations into Hissuno sessions

-- 1. Intercom connections - stores workspace credentials and sync config
CREATE TABLE IF NOT EXISTS public.intercom_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  -- Credentials
  access_token text NOT NULL,

  -- Workspace info (fetched via /me endpoint)
  workspace_id text NOT NULL,
  workspace_name text,

  -- Sync configuration
  sync_frequency text NOT NULL DEFAULT 'manual' CHECK (sync_frequency IN ('manual', '1h', '6h', '24h')),
  sync_enabled boolean NOT NULL DEFAULT true,
  filter_config jsonb DEFAULT '{}',  -- { fromDate: ISO string, toDate: ISO string }

  -- Sync state tracking
  last_sync_at timestamptz,
  last_sync_status text CHECK (last_sync_status IN ('success', 'error', 'in_progress')),
  last_sync_error text,
  last_sync_conversations_count integer DEFAULT 0,
  next_sync_at timestamptz,

  -- Metadata
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),

  -- Ensure one connection per project
  UNIQUE(project_id)
);

ALTER TABLE public.intercom_connections OWNER TO postgres;

COMMENT ON TABLE public.intercom_connections IS 'Stores Intercom API credentials and sync configuration per project.';
COMMENT ON COLUMN public.intercom_connections.access_token IS 'Intercom access token.';
COMMENT ON COLUMN public.intercom_connections.filter_config IS 'Optional date range filter for syncing: { fromDate, toDate }.';

-- Indexes
CREATE INDEX IF NOT EXISTS intercom_connections_project_id_idx
  ON public.intercom_connections(project_id);
CREATE INDEX IF NOT EXISTS intercom_connections_next_sync_idx
  ON public.intercom_connections(next_sync_at)
  WHERE sync_enabled = true AND sync_frequency != 'manual';

-- 2. Intercom synced conversations - tracks which conversations have been synced
CREATE TABLE IF NOT EXISTS public.intercom_synced_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.intercom_connections(id) ON DELETE CASCADE,

  -- Intercom conversation reference
  intercom_conversation_id text NOT NULL,

  -- Hissuno session reference
  session_id text NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,

  -- Sync metadata
  conversation_created_at timestamptz,  -- Original Intercom timestamp
  conversation_updated_at timestamptz,  -- For future delta sync support
  parts_count integer DEFAULT 0,

  synced_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),

  -- Prevent duplicate syncs
  UNIQUE(connection_id, intercom_conversation_id)
);

ALTER TABLE public.intercom_synced_conversations OWNER TO postgres;

COMMENT ON TABLE public.intercom_synced_conversations IS 'Tracks synced Intercom conversations to prevent duplicates.';

-- Indexes
CREATE INDEX IF NOT EXISTS intercom_synced_conversations_connection_idx
  ON public.intercom_synced_conversations(connection_id);
CREATE INDEX IF NOT EXISTS intercom_synced_conversations_session_idx
  ON public.intercom_synced_conversations(session_id);
CREATE INDEX IF NOT EXISTS intercom_synced_conversations_intercom_id_idx
  ON public.intercom_synced_conversations(intercom_conversation_id);

-- 3. Intercom sync runs - history of sync operations for debugging
CREATE TABLE IF NOT EXISTS public.intercom_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.intercom_connections(id) ON DELETE CASCADE,

  -- Run metadata
  triggered_by text NOT NULL CHECK (triggered_by IN ('manual', 'cron')),
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'success', 'error')),

  -- Results
  conversations_found integer DEFAULT 0,
  conversations_synced integer DEFAULT 0,
  conversations_skipped integer DEFAULT 0,
  error_message text,

  -- Timing
  started_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  completed_at timestamptz
);

ALTER TABLE public.intercom_sync_runs OWNER TO postgres;

COMMENT ON TABLE public.intercom_sync_runs IS 'Sync run history for debugging and monitoring.';

-- Indexes
CREATE INDEX IF NOT EXISTS intercom_sync_runs_connection_idx
  ON public.intercom_sync_runs(connection_id);
CREATE INDEX IF NOT EXISTS intercom_sync_runs_started_at_idx
  ON public.intercom_sync_runs(started_at DESC);

-- Enable RLS on all tables
ALTER TABLE public.intercom_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intercom_synced_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intercom_sync_runs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for intercom_connections
CREATE POLICY "Users can view their Intercom connections"
ON public.intercom_connections FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = intercom_connections.project_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert Intercom connections for their projects"
ON public.intercom_connections FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = intercom_connections.project_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their Intercom connections"
ON public.intercom_connections FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = intercom_connections.project_id
    AND projects.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = intercom_connections.project_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their Intercom connections"
ON public.intercom_connections FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = intercom_connections.project_id
    AND projects.user_id = auth.uid()
  )
);

-- RLS Policies for intercom_synced_conversations
CREATE POLICY "Users can view their synced conversations"
ON public.intercom_synced_conversations FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.intercom_connections ic
    JOIN public.projects p ON p.id = ic.project_id
    WHERE ic.id = intercom_synced_conversations.connection_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert synced conversations for their connections"
ON public.intercom_synced_conversations FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.intercom_connections ic
    JOIN public.projects p ON p.id = ic.project_id
    WHERE ic.id = intercom_synced_conversations.connection_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their synced conversations"
ON public.intercom_synced_conversations FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.intercom_connections ic
    JOIN public.projects p ON p.id = ic.project_id
    WHERE ic.id = intercom_synced_conversations.connection_id
    AND p.user_id = auth.uid()
  )
);

-- RLS Policies for intercom_sync_runs
CREATE POLICY "Users can view their sync runs"
ON public.intercom_sync_runs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.intercom_connections ic
    JOIN public.projects p ON p.id = ic.project_id
    WHERE ic.id = intercom_sync_runs.connection_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert sync runs for their connections"
ON public.intercom_sync_runs FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.intercom_connections ic
    JOIN public.projects p ON p.id = ic.project_id
    WHERE ic.id = intercom_sync_runs.connection_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their sync runs"
ON public.intercom_sync_runs FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.intercom_connections ic
    JOIN public.projects p ON p.id = ic.project_id
    WHERE ic.id = intercom_sync_runs.connection_id
    AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.intercom_connections ic
    JOIN public.projects p ON p.id = ic.project_id
    WHERE ic.id = intercom_sync_runs.connection_id
    AND p.user_id = auth.uid()
  )
);

-- Trigger for updated_at on intercom_connections
CREATE TRIGGER handle_intercom_connections_updated_at
  BEFORE UPDATE ON public.intercom_connections
  FOR EACH ROW
  EXECUTE PROCEDURE extensions.moddatetime(updated_at);
