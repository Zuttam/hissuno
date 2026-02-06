-- Add slack_notification_channel column to user_profiles
-- NULL = DM to user (default)
-- 'C1234567890' = specific Slack channel ID

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS slack_notification_channel text DEFAULT NULL;

COMMENT ON COLUMN user_profiles.slack_notification_channel IS 'Slack channel ID for notifications. NULL means DM to user.';
