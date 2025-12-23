-- Create project_analyses table to track analysis history
-- This replaces the analysis_run_id and analysis_started_at columns on projects table

CREATE TABLE project_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  run_id text NOT NULL,
  status text NOT NULL DEFAULT 'running',  -- 'running', 'completed', 'failed', 'cancelled', 'timed_out'
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error_message text,
  metadata jsonb,  -- Store source count, package count, etc.
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX idx_project_analyses_project_id ON project_analyses(project_id);
CREATE INDEX idx_project_analyses_status ON project_analyses(status);
CREATE INDEX idx_project_analyses_started_at ON project_analyses(started_at DESC);

-- Add RLS policies
ALTER TABLE project_analyses ENABLE ROW LEVEL SECURITY;

-- Users can view analyses for their own projects
CREATE POLICY "Users can view their project analyses"
  ON project_analyses
  FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Users can insert analyses for their own projects
CREATE POLICY "Users can insert analyses for their projects"
  ON project_analyses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Users can update analyses for their own projects
CREATE POLICY "Users can update their project analyses"
  ON project_analyses
  FOR UPDATE
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Add comments for documentation
COMMENT ON TABLE project_analyses IS 'Tracks the history of knowledge analysis runs for each project';
COMMENT ON COLUMN project_analyses.run_id IS 'Mastra workflow run ID';
COMMENT ON COLUMN project_analyses.status IS 'Analysis status: running, completed, failed, cancelled, timed_out';
COMMENT ON COLUMN project_analyses.metadata IS 'JSON metadata including source count, package count, errors, etc.';
