-- Add is_archived column to sessions and issues tables
-- Add 'manual' as a valid session source

-- Add is_archived to sessions table
ALTER TABLE public.sessions
ADD COLUMN is_archived boolean DEFAULT false NOT NULL;

COMMENT ON COLUMN public.sessions.is_archived IS 'Whether the session is archived and hidden from default views.';

-- Add index for efficient filtering of archived sessions
CREATE INDEX IF NOT EXISTS idx_sessions_is_archived ON public.sessions (is_archived);

-- Add is_archived to issues table
ALTER TABLE public.issues
ADD COLUMN is_archived boolean DEFAULT false NOT NULL;

COMMENT ON COLUMN public.issues.is_archived IS 'Whether the issue is archived and hidden from default views.';

-- Add index for efficient filtering of archived issues
CREATE INDEX IF NOT EXISTS idx_issues_is_archived ON public.issues (is_archived);

-- Update session source constraint to include 'manual'
-- First drop the existing constraint
ALTER TABLE public.sessions
DROP CONSTRAINT IF EXISTS sessions_source_check;

-- Add the new constraint with 'manual' source
ALTER TABLE public.sessions
ADD CONSTRAINT sessions_source_check
CHECK (source IN ('widget', 'slack', 'intercom', 'gong', 'api', 'manual'));

COMMENT ON COLUMN public.sessions.source IS 'Session origin: widget, slack, intercom, gong, api, or manual (manually created).';
