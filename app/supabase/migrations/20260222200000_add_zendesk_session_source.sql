-- Add 'zendesk' to sessions.source CHECK constraint
ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_source_check;
ALTER TABLE public.sessions ADD CONSTRAINT sessions_source_check
  CHECK (source IN ('widget', 'slack', 'intercom', 'zendesk', 'gong', 'api', 'manual'));
