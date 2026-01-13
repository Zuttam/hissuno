-- Generic user notifications table
-- Tracks all notification types with flexible metadata and deduplication

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,  -- 'limit_reached', 'limit_warning', 'welcome', etc.
  channel text NOT NULL DEFAULT 'email',  -- 'email', 'in_app', 'slack'
  metadata jsonb DEFAULT '{}',  -- Flexible payload (dimension, limit, etc.)
  sent_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),

  -- Deduplication key (optional) - prevents duplicate notifications
  -- Example: 'limit_reached:sessions:2026-01' prevents duplicate per billing period
  dedup_key text,
  UNIQUE(user_id, dedup_key)
);

-- Index for querying notifications by user and type
CREATE INDEX IF NOT EXISTS user_notifications_user_type_idx
ON public.user_notifications(user_id, type);

-- Enable RLS
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications"
ON public.user_notifications FOR SELECT
USING (auth.uid() = user_id);

COMMENT ON TABLE public.user_notifications IS
  'Generic notification tracking for all user notification types.';

COMMENT ON COLUMN public.user_notifications.dedup_key IS
  'Unique key per user to prevent duplicate notifications. NULL allows duplicates.';
