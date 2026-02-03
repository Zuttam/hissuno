-- Add is_activated flag for invite-only access gating
-- New users default to false; set to true when they sign up with a valid invite code
ALTER TABLE public.user_profiles
  ADD COLUMN is_activated boolean NOT NULL DEFAULT false;

-- Activate all existing users
UPDATE public.user_profiles SET is_activated = true;
