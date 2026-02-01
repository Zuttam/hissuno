-- Add source column to waitlist table for tracking which landing page/section the signup came from
ALTER TABLE waitlist ADD COLUMN source text;

-- Add index for source column to allow filtering/grouping by source
CREATE INDEX idx_waitlist_source ON waitlist(source);
