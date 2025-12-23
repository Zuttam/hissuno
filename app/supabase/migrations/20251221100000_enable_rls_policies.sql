-- Enable RLS and create policies for public tables
-- Fixes security linter errors for: source_codes, projects, sessions

-- ============================================
-- PROJECTS TABLE
-- ============================================
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Users can view their own projects
CREATE POLICY "Users can view their own projects"
ON public.projects FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can insert their own projects
CREATE POLICY "Users can insert their own projects"
ON public.projects FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can update their own projects
CREATE POLICY "Users can update their own projects"
ON public.projects FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Users can delete their own projects
CREATE POLICY "Users can delete their own projects"
ON public.projects FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- ============================================
-- SOURCE_CODES TABLE
-- ============================================
ALTER TABLE public.source_codes ENABLE ROW LEVEL SECURITY;

-- Users can view their own source codes
CREATE POLICY "Users can view their own source codes"
ON public.source_codes FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can insert their own source codes
CREATE POLICY "Users can insert their own source codes"
ON public.source_codes FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can update their own source codes
CREATE POLICY "Users can update their own source codes"
ON public.source_codes FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Users can delete their own source codes
CREATE POLICY "Users can delete their own source codes"
ON public.source_codes FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- ============================================
-- SESSIONS TABLE
-- ============================================
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Users can view sessions for their projects
CREATE POLICY "Users can view sessions for their projects"
ON public.sessions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = sessions.project_id
    AND projects.user_id = auth.uid()
  )
);

-- Users can insert sessions for their projects
CREATE POLICY "Users can insert sessions for their projects"
ON public.sessions FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = sessions.project_id
    AND projects.user_id = auth.uid()
  )
);

-- Users can update sessions for their projects
CREATE POLICY "Users can update sessions for their projects"
ON public.sessions FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = sessions.project_id
    AND projects.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = sessions.project_id
    AND projects.user_id = auth.uid()
  )
);

-- Users can delete sessions for their projects
CREATE POLICY "Users can delete sessions for their projects"
ON public.sessions FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = sessions.project_id
    AND projects.user_id = auth.uid()
  )
);



