-- Add session_type column to sessions table
-- Separates content type (how to render) from source (where data came from)

ALTER TABLE sessions
  ADD COLUMN session_type text NOT NULL DEFAULT 'chat';

-- Add CHECK constraint for valid session types
ALTER TABLE sessions
  ADD CONSTRAINT sessions_session_type_check
  CHECK (session_type IN ('chat', 'meeting', 'behavioral'));

-- Add index for filtering by session type
CREATE INDEX idx_sessions_session_type ON sessions (session_type);

-- Backfill: Gong calls are meetings
UPDATE sessions SET session_type = 'meeting' WHERE source = 'gong';
