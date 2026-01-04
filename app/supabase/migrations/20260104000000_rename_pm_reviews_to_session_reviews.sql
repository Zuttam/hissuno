-- Rename pm_reviews table to session_reviews
-- This aligns the naming with the broader session review system

-- Rename the table
ALTER TABLE pm_reviews RENAME TO session_reviews;

-- Rename indexes
ALTER INDEX idx_pm_reviews_session_id RENAME TO idx_session_reviews_session_id;
ALTER INDEX idx_pm_reviews_project_id RENAME TO idx_session_reviews_project_id;
ALTER INDEX idx_pm_reviews_status RENAME TO idx_session_reviews_status;
ALTER INDEX idx_pm_reviews_started_at RENAME TO idx_session_reviews_started_at;
ALTER INDEX idx_pm_reviews_running_session RENAME TO idx_session_reviews_running_session;

-- Drop old RLS policies and create new ones with updated names
DROP POLICY IF EXISTS "Users can view their PM reviews" ON session_reviews;
DROP POLICY IF EXISTS "Users can insert PM reviews for their projects" ON session_reviews;
DROP POLICY IF EXISTS "Users can update their PM reviews" ON session_reviews;

-- Recreate policies with new names
CREATE POLICY "Users can view their session reviews"
  ON session_reviews
  FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert session reviews for their projects"
  ON session_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their session reviews"
  ON session_reviews
  FOR UPDATE
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Update comments
COMMENT ON TABLE session_reviews IS 'Tracks session review analysis runs, enabling persistent state and SSE streaming';
COMMENT ON COLUMN session_reviews.run_id IS 'Unique identifier for the session review run';
COMMENT ON COLUMN session_reviews.status IS 'Review status: running, completed, failed';
COMMENT ON COLUMN session_reviews.result IS 'SessionReviewResult JSON stored on completion';
COMMENT ON COLUMN session_reviews.metadata IS 'JSON metadata including trigger source, etc.';
