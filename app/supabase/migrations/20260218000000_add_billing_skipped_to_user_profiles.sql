ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS billing_skipped boolean NOT NULL DEFAULT false;
