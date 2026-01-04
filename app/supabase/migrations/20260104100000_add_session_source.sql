-- Add source field to track session origin channel
ALTER TABLE public.sessions
ADD COLUMN source text DEFAULT 'widget';

-- Add constraint for valid sources (extensible for future integrations)
ALTER TABLE public.sessions
ADD CONSTRAINT sessions_source_check
CHECK (source IN ('widget', 'slack', 'intercom', 'gong', 'api'));

-- Add index for filtering by source
CREATE INDEX IF NOT EXISTS idx_sessions_source ON public.sessions (source);
