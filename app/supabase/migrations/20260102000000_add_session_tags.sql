-- Add session tags column for multi-class classification
-- Tags: general_feedback, wins, losses, bug, feature_request, change_request

-- Add tags column as text array
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Add timestamp for when tags were auto-applied
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS tags_auto_applied_at timestamptz;

-- Create GIN index for efficient tag filtering
CREATE INDEX IF NOT EXISTS sessions_tags_idx
  ON public.sessions USING GIN (tags);

-- Add constraint to validate tag values (must be from predefined set)
ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_tags_check
  CHECK (
    tags <@ ARRAY['general_feedback', 'wins', 'losses', 'bug', 'feature_request', 'change_request']::text[]
  );

-- Add comments for documentation
COMMENT ON COLUMN public.sessions.tags IS 'Array of classification tags. Valid values: general_feedback, wins, losses, bug, feature_request, change_request';
COMMENT ON COLUMN public.sessions.tags_auto_applied_at IS 'Timestamp when AI auto-applied tags during session review';
