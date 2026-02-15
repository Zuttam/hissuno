-- Replace projects_limit with issues_limit on subscriptions table
-- Issues are counted by analysis_computed_at IS NOT NULL, same tier numbers as sessions

-- Add issues_limit column (default null = unlimited)
ALTER TABLE subscriptions ADD COLUMN issues_limit integer DEFAULT NULL;

-- Copy sessions_limit values to issues_limit for existing subscriptions
-- (same tier numbers: Basic 200, Pro 1000, Unlimited null)
UPDATE subscriptions SET issues_limit = sessions_limit;

-- Drop the projects_limit column
ALTER TABLE subscriptions DROP COLUMN projects_limit;
