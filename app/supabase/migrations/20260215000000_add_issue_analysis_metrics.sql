-- Add issue analysis metrics columns to issues table
ALTER TABLE public.issues
  ADD COLUMN velocity_score integer NULL CHECK (velocity_score >= 1 AND velocity_score <= 5),
  ADD COLUMN velocity_reasoning text NULL,
  ADD COLUMN effort_score integer NULL CHECK (effort_score >= 1 AND effort_score <= 5),
  ADD COLUMN analysis_computed_at timestamptz NULL;

-- Create issue analysis runs tracking table (mirrors issue_spec_runs pattern)
CREATE TABLE public.issue_analysis_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  run_id text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  error_message text,
  metadata jsonb DEFAULT '{}'
);

-- Indexes
CREATE INDEX idx_issues_velocity_score ON public.issues (velocity_score) WHERE velocity_score IS NOT NULL;
CREATE INDEX idx_issues_effort_score ON public.issues (effort_score) WHERE effort_score IS NOT NULL;
CREATE INDEX idx_issue_analysis_runs_issue_status ON public.issue_analysis_runs (issue_id, status);

-- Enable RLS on issue_analysis_runs
ALTER TABLE public.issue_analysis_runs ENABLE ROW LEVEL SECURITY;

-- RLS policies for issue_analysis_runs (same pattern as issue_spec_runs)
CREATE POLICY "Users can view analysis runs for their project issues"
  ON public.issue_analysis_runs
  FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert analysis runs for their projects"
  ON public.issue_analysis_runs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their issue analysis runs"
  ON public.issue_analysis_runs
  FOR UPDATE
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );
