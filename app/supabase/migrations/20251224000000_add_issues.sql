-- Add issues table for tracking bugs, feature requests, and change requests
-- Issues are created by the PM Agent from session analysis

CREATE TABLE IF NOT EXISTS public.issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('bug', 'feature_request', 'change_request')),
  title text NOT NULL,
  description text NOT NULL,
  priority text NOT NULL DEFAULT 'low' CHECK (priority IN ('low', 'medium', 'high')),
  priority_manual_override boolean DEFAULT false,
  upvote_count integer DEFAULT 1,
  status text DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  product_spec text,
  product_spec_generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.issues OWNER TO postgres;

COMMENT ON TABLE public.issues IS 'Issues (bugs, feature requests, change requests) derived from session analysis by the PM Agent.';
COMMENT ON COLUMN public.issues.type IS 'Classification: bug, feature_request, or change_request.';
COMMENT ON COLUMN public.issues.priority IS 'Priority level: low, medium, or high.';
COMMENT ON COLUMN public.issues.priority_manual_override IS 'If true, priority was set manually and should not be auto-updated by upvotes.';
COMMENT ON COLUMN public.issues.upvote_count IS 'Number of sessions that contributed to this issue (starts at 1).';
COMMENT ON COLUMN public.issues.product_spec IS 'Generated product specification (markdown) when threshold is reached.';

-- Junction table for many-to-many relationship between issues and sessions
CREATE TABLE IF NOT EXISTS public.issue_sessions (
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  session_id text NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (issue_id, session_id)
);

ALTER TABLE public.issue_sessions OWNER TO postgres;

COMMENT ON TABLE public.issue_sessions IS 'Links issues to the sessions that contributed to them.';

-- Project settings table for configurable thresholds
CREATE TABLE IF NOT EXISTS public.project_settings (
  project_id uuid PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  issue_spec_threshold integer DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.project_settings OWNER TO postgres;

COMMENT ON TABLE public.project_settings IS 'Per-project settings for the PM Agent and issue management.';
COMMENT ON COLUMN public.project_settings.issue_spec_threshold IS 'Upvote count threshold for auto-generating product specifications.';

-- Add PM review tracking to sessions
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS pm_reviewed_at timestamptz;

COMMENT ON COLUMN public.sessions.pm_reviewed_at IS 'Timestamp when the PM Agent analyzed this session.';

-- Indexes for issues
CREATE INDEX IF NOT EXISTS issues_project_id_idx ON public.issues(project_id);
CREATE INDEX IF NOT EXISTS issues_status_idx ON public.issues(status);
CREATE INDEX IF NOT EXISTS issues_type_idx ON public.issues(type);
CREATE INDEX IF NOT EXISTS issues_priority_idx ON public.issues(priority);
CREATE INDEX IF NOT EXISTS issues_created_at_idx ON public.issues(created_at DESC);
CREATE INDEX IF NOT EXISTS issues_upvote_count_idx ON public.issues(upvote_count DESC);

-- Indexes for issue_sessions
CREATE INDEX IF NOT EXISTS issue_sessions_session_id_idx ON public.issue_sessions(session_id);

-- Trigger for issues updated_at
CREATE TRIGGER handle_issues_updated_at
  BEFORE UPDATE ON public.issues
  FOR EACH ROW
  EXECUTE PROCEDURE extensions.moddatetime(updated_at);

-- Trigger for project_settings updated_at
CREATE TRIGGER handle_project_settings_updated_at
  BEFORE UPDATE ON public.project_settings
  FOR EACH ROW
  EXECUTE PROCEDURE extensions.moddatetime(updated_at);

-- Row Level Security for issues
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view issues for their projects" ON public.issues
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = issues.project_id 
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert issues for their projects" ON public.issues
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = issues.project_id 
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update issues for their projects" ON public.issues
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = issues.project_id 
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete issues for their projects" ON public.issues
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = issues.project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- Row Level Security for issue_sessions
ALTER TABLE public.issue_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view issue_sessions for their issues" ON public.issue_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.issues
      JOIN public.projects ON projects.id = issues.project_id
      WHERE issues.id = issue_sessions.issue_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert issue_sessions for their issues" ON public.issue_sessions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.issues
      JOIN public.projects ON projects.id = issues.project_id
      WHERE issues.id = issue_sessions.issue_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete issue_sessions for their issues" ON public.issue_sessions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.issues
      JOIN public.projects ON projects.id = issues.project_id
      WHERE issues.id = issue_sessions.issue_id
      AND projects.user_id = auth.uid()
    )
  );

-- Row Level Security for project_settings
ALTER TABLE public.project_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view settings for their projects" ON public.project_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = project_settings.project_id 
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert settings for their projects" ON public.project_settings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = project_settings.project_id 
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update settings for their projects" ON public.project_settings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = project_settings.project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- Service role bypass policies (for Mastra/API operations)
CREATE POLICY "Service role can manage issues" ON public.issues
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage issue_sessions" ON public.issue_sessions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage project_settings" ON public.project_settings
  FOR ALL USING (auth.role() = 'service_role');
