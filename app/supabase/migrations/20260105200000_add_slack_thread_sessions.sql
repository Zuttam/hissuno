-- Mapping between Slack threads and Hissuno sessions
-- Tracks which threads are being monitored as sessions

CREATE TABLE public.slack_thread_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES public.slack_channels(id) ON DELETE CASCADE,
  slack_channel_id text NOT NULL,
  thread_ts text NOT NULL,
  has_external_participants boolean DEFAULT false,
  last_message_ts text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(channel_id, thread_ts)
);

-- Enable RLS
ALTER TABLE public.slack_thread_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view thread sessions for their projects
CREATE POLICY "Users can view slack thread sessions"
  ON public.slack_thread_sessions
  FOR SELECT
  USING (
    channel_id IN (
      SELECT sc.id FROM public.slack_channels sc
      JOIN public.slack_workspace_tokens swt ON swt.id = sc.workspace_token_id
      JOIN public.projects p ON p.id = swt.project_id
      WHERE p.user_id = auth.uid()
    )
  );

-- Index for thread lookup
CREATE INDEX idx_slack_thread_sessions_thread ON public.slack_thread_sessions(slack_channel_id, thread_ts);
CREATE INDEX idx_slack_thread_sessions_session ON public.slack_thread_sessions(session_id);
