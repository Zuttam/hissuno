-- Add selected_use_cases column to user_profiles
-- Stores the use cases selected during onboarding

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS selected_use_cases text[] DEFAULT '{}';

COMMENT ON COLUMN public.user_profiles.selected_use_cases IS 'Use cases selected during onboarding (knowledge, slack, triage, specs)';
