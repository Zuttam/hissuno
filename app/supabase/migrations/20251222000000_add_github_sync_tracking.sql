-- Add columns to track GitHub repository sync state
-- commit_sha: The commit SHA of the synced version
-- synced_at: When the repository was last synced

ALTER TABLE source_codes
  ADD COLUMN commit_sha text,
  ADD COLUMN synced_at timestamptz;

-- Add comment for documentation
COMMENT ON COLUMN source_codes.commit_sha IS 'Git commit SHA of the synced codebase version (for GitHub sources)';
COMMENT ON COLUMN source_codes.synced_at IS 'Timestamp when the codebase was last synced from GitHub';
