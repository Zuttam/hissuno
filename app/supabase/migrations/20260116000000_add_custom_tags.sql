-- Custom tags table for project-specific session classification
-- Allows users to define up to 10 custom tags per project

CREATE TABLE IF NOT EXISTS public.custom_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,           -- Display name (e.g., "Onboarding Issue")
  slug text NOT NULL,           -- Internal identifier (e.g., "onboarding_issue")
  description text NOT NULL,    -- Classification guidance for AI
  color text DEFAULT 'info',    -- Badge color variant (info, success, danger, warning, default)
  position smallint NOT NULL DEFAULT 0, -- Display order
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),

  -- Ensure unique slugs per project
  UNIQUE(project_id, slug),

  -- Limit to 10 labels per project (positions 0-9)
  CONSTRAINT max_labels_per_project CHECK (position >= 0 AND position < 10),

  -- Validate slug format (lowercase snake_case)
  CONSTRAINT valid_slug CHECK (slug ~ '^[a-z][a-z0-9_]*$'),

  -- Validate name length
  CONSTRAINT valid_name CHECK (char_length(name) >= 1 AND char_length(name) <= 50),

  -- Validate description length
  CONSTRAINT valid_description CHECK (char_length(description) >= 1 AND char_length(description) <= 500)
);

-- Index for efficient lookup by project
CREATE INDEX IF NOT EXISTS custom_tags_project_id_idx ON public.custom_tags(project_id);

-- Index for slug lookups (used when validating session tags)
CREATE INDEX IF NOT EXISTS custom_tags_project_slug_idx ON public.custom_tags(project_id, slug);

-- Trigger for updated_at
CREATE TRIGGER handle_custom_tags_updated_at
  BEFORE UPDATE ON public.custom_tags
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Enable Row Level Security
ALTER TABLE public.custom_tags ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can view custom tags for their own projects
CREATE POLICY "Users can view custom tags for their projects"
  ON public.custom_tags
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = custom_tags.project_id
      AND user_id = auth.uid()
    )
  );

-- RLS policy: Users can insert custom tags for their own projects
CREATE POLICY "Users can create custom tags for their projects"
  ON public.custom_tags
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = custom_tags.project_id
      AND user_id = auth.uid()
    )
  );

-- RLS policy: Users can update custom tags for their own projects
CREATE POLICY "Users can update custom tags for their projects"
  ON public.custom_tags
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = custom_tags.project_id
      AND user_id = auth.uid()
    )
  );

-- RLS policy: Users can delete custom tags for their own projects
CREATE POLICY "Users can delete custom tags for their projects"
  ON public.custom_tags
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = custom_tags.project_id
      AND user_id = auth.uid()
    )
  );

-- Remove the rigid CHECK constraint on sessions.tags to allow custom tag slugs
-- The constraint was: tags <@ ARRAY['general_feedback', 'wins', 'losses', 'bug', 'feature_request', 'change_request']::text[]
-- Validation will now be handled at the application layer
ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_tags_check;

-- Add a comment explaining the new flexible tags approach
COMMENT ON COLUMN public.sessions.tags IS 'Array of classification tags. Includes native tags (general_feedback, wins, losses, bug, feature_request, change_request) and project-specific custom tag slugs. Validation is handled at the application layer.';

COMMENT ON TABLE public.custom_tags IS 'Custom classification tags defined per-project for session tagging. Each project can have up to 10 custom tags.';
