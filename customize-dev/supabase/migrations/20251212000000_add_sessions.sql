-- Add sessions table for tracking widget conversations
-- Sessions store metadata while messages are fetched on-demand from Mastra storage

CREATE TABLE IF NOT EXISTS public.sessions (
  id text PRIMARY KEY,                    -- threadId from CopilotKit/Mastra
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id text,                           -- end-user ID from widget
  user_metadata jsonb DEFAULT '{}',       -- optional user info (name, email, etc.)
  page_url text,                          -- URL where the session started
  page_title text,                        -- Page title where the session started
  message_count integer DEFAULT 0,        -- denormalized count for quick display
  status text DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  first_message_at timestamptz,           -- timestamp of first message
  last_activity_at timestamptz DEFAULT timezone('utc'::text, now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.sessions OWNER TO postgres;

COMMENT ON TABLE public.sessions IS 'Widget conversation sessions. Messages are stored in Mastra and fetched on-demand.';
COMMENT ON COLUMN public.sessions.id IS 'Thread ID from CopilotKit/Mastra - serves as the session identifier.';
COMMENT ON COLUMN public.sessions.user_id IS 'End-user identifier provided by the widget consumer.';
COMMENT ON COLUMN public.sessions.user_metadata IS 'Optional user metadata (name, email, plan, etc.) as JSON.';

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS sessions_project_id_idx ON public.sessions(project_id);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON public.sessions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sessions_last_activity_idx ON public.sessions(last_activity_at DESC);
CREATE INDEX IF NOT EXISTS sessions_status_idx ON public.sessions(status);
CREATE INDEX IF NOT EXISTS sessions_created_at_idx ON public.sessions(created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER handle_sessions_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW
  EXECUTE PROCEDURE extensions.moddatetime(updated_at);
