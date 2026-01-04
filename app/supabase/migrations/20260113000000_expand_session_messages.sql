-- Migration: Expand session_messages to store all message types
-- This allows session_messages to be the single source of truth for app display

-- 1. Drop existing constraint
ALTER TABLE public.session_messages
DROP CONSTRAINT IF EXISTS session_messages_sender_type_check;

-- 2. Add new constraint with expanded types (user, ai, human_agent, system)
ALTER TABLE public.session_messages
ADD CONSTRAINT session_messages_sender_type_check
CHECK (sender_type IN ('user', 'ai', 'human_agent', 'system'));

-- 3. Add composite index for efficient session message queries
CREATE INDEX IF NOT EXISTS session_messages_session_created_idx
ON public.session_messages(session_id, created_at ASC);
