-- Add channel mode for per-channel behavior control
-- channel_mode: 'interactive' (respond to mentions, subscribe to threads) or 'passive' (listen only, never respond)
-- capture_scope: 'external_only' (only capture threads with external participants) or 'all' (capture all threads) - applies to passive mode

ALTER TABLE public.slack_channels
ADD COLUMN channel_mode text DEFAULT 'interactive'
  CHECK (channel_mode IN ('interactive', 'passive')),
ADD COLUMN capture_scope text DEFAULT 'external_only'
  CHECK (capture_scope IN ('external_only', 'all'));

-- Add response tracking for intelligent thread responses
-- last_responder_type: tracks whether bot or user sent the last message in the thread
-- last_bot_response_ts: timestamp of the last bot response for tracking continuity

ALTER TABLE public.slack_thread_sessions
ADD COLUMN last_responder_type text CHECK (last_responder_type IN ('bot', 'user')),
ADD COLUMN last_bot_response_ts text;

-- Index for efficient channel mode lookups
CREATE INDEX idx_slack_channels_mode ON public.slack_channels(channel_mode);

-- Index for efficient thread session lookups by channel and thread
CREATE INDEX idx_slack_thread_sessions_lookup ON public.slack_thread_sessions(channel_id, thread_ts);

COMMENT ON COLUMN public.slack_channels.channel_mode IS 'interactive: respond to mentions and manage thread subscriptions, passive: silent observer that only captures sessions';
COMMENT ON COLUMN public.slack_channels.capture_scope IS 'For passive mode: external_only captures only threads with external participants, all captures every thread';
COMMENT ON COLUMN public.slack_thread_sessions.last_responder_type IS 'Tracks whether the last message in the thread was from the bot or a user for intelligent response decisions';
COMMENT ON COLUMN public.slack_thread_sessions.last_bot_response_ts IS 'Timestamp of the last bot response in the thread';
