-- Create chat_runs table to track agent chat runs with SSE streaming
-- This enables real-time streaming with cancel support for the widget and test dialog

CREATE TABLE chat_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  run_id text NOT NULL,
  status text NOT NULL DEFAULT 'running',  -- 'running', 'completed', 'failed', 'cancelled'
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error_message text,
  metadata jsonb,  -- Store messages, user info, etc.
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX idx_chat_runs_project_id ON chat_runs(project_id);
CREATE INDEX idx_chat_runs_session_id ON chat_runs(session_id);
CREATE INDEX idx_chat_runs_status ON chat_runs(status);
CREATE INDEX idx_chat_runs_started_at ON chat_runs(started_at DESC);

-- Add RLS policies
ALTER TABLE chat_runs ENABLE ROW LEVEL SECURITY;

-- Users can view chat runs for their own projects (dashboard access)
CREATE POLICY "Users can view their chat runs"
  ON chat_runs
  FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Users can insert chat runs for their own projects
CREATE POLICY "Users can insert chat runs for their projects"
  ON chat_runs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Users can update chat runs for their own projects
CREATE POLICY "Users can update their chat runs"
  ON chat_runs
  FOR UPDATE
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Add comments for documentation
COMMENT ON TABLE chat_runs IS 'Tracks agent chat runs with SSE streaming support for widget and test dialog';
COMMENT ON COLUMN chat_runs.run_id IS 'Unique run identifier for SSE streaming';
COMMENT ON COLUMN chat_runs.status IS 'Chat run status: running, completed, failed, cancelled';
COMMENT ON COLUMN chat_runs.metadata IS 'JSON metadata including messages, user info, etc.';
