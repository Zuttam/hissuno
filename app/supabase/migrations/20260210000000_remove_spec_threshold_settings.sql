-- Remove spec threshold and guidelines settings (auto-trigger being replaced with new flow)
ALTER TABLE public.project_settings DROP COLUMN IF EXISTS issue_spec_threshold;
ALTER TABLE public.project_settings DROP COLUMN IF EXISTS spec_guidelines;
