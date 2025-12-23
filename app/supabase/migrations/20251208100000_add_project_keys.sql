-- Add public/secret key system for widget authentication
-- This follows the Stripe/Intercom model where:
--   - public_key (pk_live_...) is safe to expose in frontend widgets
--   - secret_key (sk_live_...) is for backend/dashboard operations only
--   - allowed_origins restricts which domains can use the widget

-- Add the new columns to projects table
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS public_key text UNIQUE,
  ADD COLUMN IF NOT EXISTS secret_key text UNIQUE,
  ADD COLUMN IF NOT EXISTS allowed_origins text[] DEFAULT '{}';

-- Add comments for documentation
COMMENT ON COLUMN public.projects.public_key IS 'Public key (pk_live_...) safe to expose in frontend widgets. Used to identify the project.';
COMMENT ON COLUMN public.projects.secret_key IS 'Secret key (sk_live_...) for backend/dashboard operations. Never expose in frontend code.';
COMMENT ON COLUMN public.projects.allowed_origins IS 'List of allowed origins (domains) that can use the widget with this project. Empty array allows all origins (for development).';

-- Create indexes for key lookups (used by the CopilotKit endpoint)
CREATE INDEX IF NOT EXISTS projects_public_key_idx ON public.projects (public_key) WHERE public_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS projects_secret_key_idx ON public.projects (secret_key) WHERE secret_key IS NOT NULL;

-- Function to generate a random key with a given prefix and length
CREATE OR REPLACE FUNCTION generate_project_key(prefix text, random_length integer)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  result text := prefix;
  i integer;
BEGIN
  FOR i IN 1..random_length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Trigger function to auto-generate keys on project creation if not provided
CREATE OR REPLACE FUNCTION auto_generate_project_keys()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Generate public key if not provided
  IF NEW.public_key IS NULL THEN
    NEW.public_key := generate_project_key('pk_live_', 24);
  END IF;
  
  -- Generate secret key if not provided
  IF NEW.secret_key IS NULL THEN
    NEW.secret_key := generate_project_key('sk_live_', 32);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for auto-generating keys on insert
DROP TRIGGER IF EXISTS auto_generate_project_keys_trigger ON public.projects;
CREATE TRIGGER auto_generate_project_keys_trigger
  BEFORE INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_project_keys();

-- Generate keys for existing projects that don't have them
UPDATE public.projects
SET 
  public_key = generate_project_key('pk_live_', 24),
  secret_key = generate_project_key('sk_live_', 32)
WHERE public_key IS NULL OR secret_key IS NULL;

