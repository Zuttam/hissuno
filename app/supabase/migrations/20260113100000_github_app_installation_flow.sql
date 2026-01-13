-- Migration: GitHub App Installation Flow
-- Changes OAuth token storage to installation ID storage
-- Installation tokens are generated on-demand using JWT

-- Add installation_id column for GitHub App flow
ALTER TABLE public.github_app_installations
  ADD COLUMN installation_id bigint;

-- Make access_token nullable (tokens now generated on-demand)
ALTER TABLE public.github_app_installations
  ALTER COLUMN access_token DROP NOT NULL;

-- Add index for installation lookups
CREATE INDEX idx_github_installations_installation_id
  ON public.github_app_installations(installation_id);

-- Add column for installation target type (User or Organization)
ALTER TABLE public.github_app_installations
  ADD COLUMN target_type text;

-- Add comment explaining the new flow
COMMENT ON TABLE public.github_app_installations IS
  'GitHub App installations per project. Supports both legacy OAuth tokens (access_token) and new GitHub App flow (installation_id).';

COMMENT ON COLUMN public.github_app_installations.installation_id IS
  'GitHub App installation ID. Used to generate short-lived access tokens via JWT.';

COMMENT ON COLUMN public.github_app_installations.access_token IS
  'Legacy OAuth access token. Nullable for new GitHub App installations where tokens are generated on-demand.';

COMMENT ON COLUMN public.github_app_installations.target_type IS
  'Installation target type: User or Organization.';
