ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS onboarding_current_step text;
