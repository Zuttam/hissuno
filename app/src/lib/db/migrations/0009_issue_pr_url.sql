-- Add pr_url to issues so the hissuno-continuous-dev skill can record the PR
-- that shipped an issue.
ALTER TABLE "issues" ADD COLUMN IF NOT EXISTS "pr_url" text;
