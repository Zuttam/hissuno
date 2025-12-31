-- Create issue_spec_runs table to track spec generation runs
-- This enables persistent background spec generation with SSE streaming

CREATE TABLE issue_spec_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  run_id text NOT NULL,
  status text NOT NULL DEFAULT 'running',  -- 'running', 'completed', 'failed', 'cancelled'
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error_message text,
  metadata jsonb,  -- Store progress info, agent config, etc.
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX idx_issue_spec_runs_issue_id ON issue_spec_runs(issue_id);
CREATE INDEX idx_issue_spec_runs_project_id ON issue_spec_runs(project_id);
CREATE INDEX idx_issue_spec_runs_status ON issue_spec_runs(status);
CREATE INDEX idx_issue_spec_runs_started_at ON issue_spec_runs(started_at DESC);

-- Add RLS policies
ALTER TABLE issue_spec_runs ENABLE ROW LEVEL SECURITY;

-- Users can view spec runs for their own projects
CREATE POLICY "Users can view their issue spec runs"
  ON issue_spec_runs
  FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Users can insert spec runs for their own projects
CREATE POLICY "Users can insert spec runs for their projects"
  ON issue_spec_runs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Users can update spec runs for their own projects
CREATE POLICY "Users can update their issue spec runs"
  ON issue_spec_runs
  FOR UPDATE
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Add comments for documentation
COMMENT ON TABLE issue_spec_runs IS 'Tracks the history of product spec generation runs for each issue';
COMMENT ON COLUMN issue_spec_runs.run_id IS 'Unique run identifier for SSE streaming';
COMMENT ON COLUMN issue_spec_runs.status IS 'Spec generation status: running, completed, failed, cancelled';
COMMENT ON COLUMN issue_spec_runs.metadata IS 'JSON metadata including progress info, agent config, etc.';
