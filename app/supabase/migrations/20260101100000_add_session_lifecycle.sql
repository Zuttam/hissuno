-- Add session lifecycle columns and settings
-- Supports goodbye detection, idle handling, and scheduled closing

-- ============================================
-- EXTEND SESSIONS TABLE
-- ============================================

-- Add lifecycle tracking columns
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS goodbye_detected_at timestamptz,
  ADD COLUMN IF NOT EXISTS idle_prompt_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_close_at timestamptz;

-- Add pm_reviewed_at if not exists (for tracking when PM review completed)
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS pm_reviewed_at timestamptz;

-- Drop existing status constraint and recreate with new values
ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_status_check;
ALTER TABLE public.sessions ADD CONSTRAINT sessions_status_check
  CHECK (status IN ('active', 'closing_soon', 'awaiting_idle_response', 'closed'));

-- Index for finding sessions to auto-close
CREATE INDEX IF NOT EXISTS sessions_scheduled_close_idx
  ON public.sessions(scheduled_close_at)
  WHERE scheduled_close_at IS NOT NULL AND status != 'closed';

-- Index for finding idle sessions
CREATE INDEX IF NOT EXISTS sessions_idle_check_idx
  ON public.sessions(last_activity_at, status)
  WHERE status = 'active';

COMMENT ON COLUMN public.sessions.goodbye_detected_at IS 'When the AI detected a goodbye intent from the user.';
COMMENT ON COLUMN public.sessions.idle_prompt_sent_at IS 'When the idle check prompt was sent to the user.';
COMMENT ON COLUMN public.sessions.scheduled_close_at IS 'When the session is scheduled to auto-close.';
COMMENT ON COLUMN public.sessions.pm_reviewed_at IS 'When the PM review was completed for this session.';

-- ============================================
-- EXTEND PROJECT SETTINGS
-- ============================================

-- Add session lifecycle settings columns
ALTER TABLE public.project_settings
  ADD COLUMN IF NOT EXISTS session_idle_timeout_minutes integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS session_goodbye_delay_seconds integer DEFAULT 90,
  ADD COLUMN IF NOT EXISTS session_idle_response_timeout_seconds integer DEFAULT 60;

-- Add constraints for valid ranges
ALTER TABLE public.project_settings
  ADD CONSTRAINT session_idle_timeout_check
    CHECK (session_idle_timeout_minutes >= 1 AND session_idle_timeout_minutes <= 60),
  ADD CONSTRAINT session_goodbye_delay_check
    CHECK (session_goodbye_delay_seconds >= 30 AND session_goodbye_delay_seconds <= 300),
  ADD CONSTRAINT session_idle_response_timeout_check
    CHECK (session_idle_response_timeout_seconds >= 30 AND session_idle_response_timeout_seconds <= 180);

COMMENT ON COLUMN public.project_settings.session_idle_timeout_minutes IS 'Minutes of inactivity before asking user if still there (1-60).';
COMMENT ON COLUMN public.project_settings.session_goodbye_delay_seconds IS 'Seconds to keep session open after goodbye detection (30-300).';
COMMENT ON COLUMN public.project_settings.session_idle_response_timeout_seconds IS 'Seconds to wait for response after idle prompt before auto-close (30-180).';
