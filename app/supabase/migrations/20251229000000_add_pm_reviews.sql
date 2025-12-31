-- Create pm_reviews table to track PM review analysis runs for sessions
-- This enables persistent state that survives page refresh and real-time SSE streaming

CREATE TABLE pm_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  run_id text NOT NULL,
  status text NOT NULL DEFAULT 'running',  -- 'running', 'completed', 'failed'
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error_message text,
  result jsonb,  -- PMReviewResult on completion
  metadata jsonb,  -- Store trigger source, etc.
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX idx_pm_reviews_session_id ON pm_reviews(session_id);
CREATE INDEX idx_pm_reviews_project_id ON pm_reviews(project_id);
CREATE INDEX idx_pm_reviews_status ON pm_reviews(status);
CREATE INDEX idx_pm_reviews_started_at ON pm_reviews(started_at DESC);

-- Prevent concurrent reviews on the same session
CREATE UNIQUE INDEX idx_pm_reviews_running_session
  ON pm_reviews(session_id)
  WHERE status = 'running';

-- Add RLS policies
ALTER TABLE pm_reviews ENABLE ROW LEVEL SECURITY;

-- Users can view PM reviews for their own projects
CREATE POLICY "Users can view their PM reviews"
  ON pm_reviews
  FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Users can insert PM reviews for their own projects
CREATE POLICY "Users can insert PM reviews for their projects"
  ON pm_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Users can update PM reviews for their own projects
CREATE POLICY "Users can update their PM reviews"
  ON pm_reviews
  FOR UPDATE
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Add comments for documentation
COMMENT ON TABLE pm_reviews IS 'Tracks PM review analysis runs for sessions, enabling persistent state and SSE streaming';
COMMENT ON COLUMN pm_reviews.run_id IS 'Unique identifier for the PM review run';
COMMENT ON COLUMN pm_reviews.status IS 'Review status: running, completed, failed';
COMMENT ON COLUMN pm_reviews.result IS 'PMReviewResult JSON stored on completion';
COMMENT ON COLUMN pm_reviews.metadata IS 'JSON metadata including trigger source, etc.';
