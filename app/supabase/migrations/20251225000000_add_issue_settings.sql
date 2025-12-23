-- Add issue tracking settings to project_settings table
-- Migration: Add issue_tracking_enabled and spec_guidelines columns

ALTER TABLE public.project_settings 
ADD COLUMN IF NOT EXISTS issue_tracking_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS spec_guidelines text;

COMMENT ON COLUMN public.project_settings.issue_tracking_enabled IS 'Whether automated issue tracking is enabled for this project.';
COMMENT ON COLUMN public.project_settings.spec_guidelines IS 'Custom guidelines for generating product specifications.';
