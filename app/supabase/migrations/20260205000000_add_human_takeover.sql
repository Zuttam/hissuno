ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS is_human_takeover boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS human_takeover_at timestamptz,
  ADD COLUMN IF NOT EXISTS human_takeover_user_id uuid,
  ADD COLUMN IF NOT EXISTS human_takeover_slack_channel_id text,
  ADD COLUMN IF NOT EXISTS human_takeover_slack_thread_ts text;

-- Index for finding sessions in human takeover mode
CREATE INDEX IF NOT EXISTS sessions_human_takeover_idx
  ON public.sessions(project_id)
  WHERE is_human_takeover = true;

-- Index for looking up session by Slack DM channel when processing human replies
CREATE INDEX IF NOT EXISTS sessions_human_takeover_slack_channel_idx
  ON public.sessions(human_takeover_slack_channel_id)
  WHERE human_takeover_slack_channel_id IS NOT NULL;
