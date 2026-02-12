-- Add PM agent guideline columns to project_settings
ALTER TABLE public.project_settings ADD COLUMN IF NOT EXISTS spec_guidelines text;
ALTER TABLE public.project_settings ADD COLUMN IF NOT EXISTS classification_guidelines text;
ALTER TABLE public.project_settings ADD COLUMN IF NOT EXISTS analysis_guidelines text;

-- Drop stale auto-spec threshold (may not exist)
ALTER TABLE public.project_settings DROP COLUMN IF EXISTS issue_spec_threshold;
