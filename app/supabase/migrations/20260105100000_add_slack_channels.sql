-- Slack channels the bot has joined
-- Tracks active channels for monitoring

CREATE TABLE public.slack_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_token_id uuid NOT NULL REFERENCES public.slack_workspace_tokens(id) ON DELETE CASCADE,
  channel_id text NOT NULL,
  channel_name text,
  channel_type text DEFAULT 'channel',
  is_active boolean DEFAULT true,
  joined_at timestamptz DEFAULT now(),
  workspace_primary_domain text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(workspace_token_id, channel_id)
);

-- Enable RLS
ALTER TABLE public.slack_channels ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view channels for their projects
CREATE POLICY "Users can view slack channels"
  ON public.slack_channels
  FOR SELECT
  USING (
    workspace_token_id IN (
      SELECT swt.id FROM public.slack_workspace_tokens swt
      JOIN public.projects p ON p.id = swt.project_id
      WHERE p.user_id = auth.uid()
    )
  );

-- Index for channel lookup
CREATE INDEX idx_slack_channels_channel_id ON public.slack_channels(channel_id);
CREATE INDEX idx_slack_channels_workspace ON public.slack_channels(workspace_token_id);
