-- Migration: Move allowed_origins and widget_token_required from projects to project_settings
-- This migration moves widget security settings to the project_settings table where other widget config lives

-- Step 1: Add new columns to project_settings
ALTER TABLE public.project_settings
  ADD COLUMN IF NOT EXISTS allowed_origins text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS widget_token_required boolean DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN public.project_settings.allowed_origins IS 'List of allowed origins (domains) that can use the widget with this project. Empty array allows all origins.';
COMMENT ON COLUMN public.project_settings.widget_token_required IS 'When true, widget requests must include a valid JWT token signed with the project secret key.';

-- Step 2: Create project_settings rows for projects that don't have them yet
INSERT INTO public.project_settings (project_id, allowed_origins, widget_token_required)
SELECT
  p.id,
  COALESCE(p.allowed_origins, '{}'),
  COALESCE(p.widget_token_required, false)
FROM public.projects p
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_settings ps WHERE ps.project_id = p.id
)
ON CONFLICT (project_id) DO NOTHING;

-- Step 3: Update existing project_settings rows with data from projects
UPDATE public.project_settings ps
SET
  allowed_origins = COALESCE(p.allowed_origins, '{}'),
  widget_token_required = COALESCE(p.widget_token_required, false)
FROM public.projects p
WHERE ps.project_id = p.id;

-- Step 4: Drop columns from projects table
ALTER TABLE public.projects
  DROP COLUMN IF EXISTS allowed_origins,
  DROP COLUMN IF EXISTS widget_token_required;
