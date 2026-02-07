-- Add type column: 'platform_access' (existing) or 'feature_access' (in-app gating)
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'platform_access';

-- Allow same email with different types (e.g., platform waitlist + feature request)
ALTER TABLE waitlist DROP CONSTRAINT IF EXISTS waitlist_email_key;
ALTER TABLE waitlist DROP CONSTRAINT IF EXISTS waitlist_email_type_key;
ALTER TABLE waitlist ADD CONSTRAINT waitlist_email_type_key UNIQUE (email, type);

-- Index for filtering
CREATE INDEX IF NOT EXISTS idx_waitlist_type ON waitlist(type);
