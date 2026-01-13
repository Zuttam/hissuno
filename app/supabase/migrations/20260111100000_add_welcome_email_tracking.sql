-- Add welcome email tracking to user_profiles
-- This column tracks when a welcome email was sent to prevent duplicates

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS welcome_email_sent_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN public.user_profiles.welcome_email_sent_at
IS 'Timestamp when welcome email was sent. NULL means not yet sent.';
