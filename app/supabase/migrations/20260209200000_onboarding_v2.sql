-- Onboarding V2: Replace selected_use_cases with communication_channels
ALTER TABLE user_profiles DROP COLUMN IF EXISTS selected_use_cases;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS communication_channels text[] DEFAULT '{}';
