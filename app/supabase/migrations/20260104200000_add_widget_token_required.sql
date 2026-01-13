-- Add widget_token_required column to projects table
-- When true, widget requests must include a valid JWT token

ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS widget_token_required boolean DEFAULT false;

-- Add a comment for documentation
COMMENT ON COLUMN public.projects.widget_token_required IS 'When true, widget requests must include a valid JWT token signed with the project secret key';
