-- Add notification preference columns to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notifications_silenced boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS slack_user_id text;
