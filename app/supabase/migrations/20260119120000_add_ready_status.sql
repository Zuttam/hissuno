-- Add 'ready' status to issues
-- Status meanings:
--   open: Not yet reviewed by PM agent
--   ready: Ready for engineering (spec generated)
--   in_progress: Engineering work began
--   closed: Marked irrelevant by user
--   resolved: Issue merged to codebase

-- Drop the existing CHECK constraint and add a new one with 5 statuses
ALTER TABLE public.issues DROP CONSTRAINT IF EXISTS issues_status_check;

ALTER TABLE public.issues ADD CONSTRAINT issues_status_check
  CHECK (status IN ('open', 'ready', 'in_progress', 'resolved', 'closed'));

COMMENT ON COLUMN public.issues.status IS 'Issue lifecycle status: open (not reviewed), ready (spec generated), in_progress (work started), resolved (merged), closed (irrelevant).';
