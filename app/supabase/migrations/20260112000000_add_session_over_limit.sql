-- Add is_over_limit column to sessions table
-- Used for soft enforcement: sessions created when account is over session limit

ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS is_over_limit boolean DEFAULT false;

-- Partial index for efficient querying of over-limit sessions
CREATE INDEX IF NOT EXISTS sessions_is_over_limit_idx
ON public.sessions(is_over_limit) WHERE is_over_limit = true;

COMMENT ON COLUMN public.sessions.is_over_limit IS
  'True if session was created when account was over session limit. PM review is skipped for over-limit sessions.';
