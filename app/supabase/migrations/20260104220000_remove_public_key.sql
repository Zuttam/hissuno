-- Remove public_key from projects table
-- The widget now uses projectId (UUID) directly instead of a separate public_key

-- Drop the index on public_key
DROP INDEX IF EXISTS projects_public_key_idx;

-- Update the trigger function to only generate secret_key (no longer generates public_key)
CREATE OR REPLACE FUNCTION auto_generate_project_keys()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Generate secret key if not provided
  IF NEW.secret_key IS NULL THEN
    NEW.secret_key := generate_project_key('sk_live_', 32);
  END IF;

  RETURN NEW;
END;
$$;

-- Drop the public_key column
ALTER TABLE public.projects DROP COLUMN IF EXISTS public_key;

-- Remove the comment (column no longer exists)
-- COMMENT ON COLUMN public.projects.public_key was automatically removed when column dropped
