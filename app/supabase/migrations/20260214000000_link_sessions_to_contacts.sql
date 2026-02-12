-- Link sessions to contacts
-- Adds contact_id FK to sessions table for connecting feedback to customers.
-- Issues inherit customer context through: Issue -> issue_sessions -> Session -> Contact -> Company

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;

-- Partial index for efficient lookups (only non-null values)
CREATE INDEX IF NOT EXISTS sessions_contact_id_idx
  ON public.sessions(contact_id) WHERE contact_id IS NOT NULL;

-- Composite index for "all sessions for a contact in a project"
CREATE INDEX IF NOT EXISTS sessions_project_contact_idx
  ON public.sessions(project_id, contact_id) WHERE contact_id IS NOT NULL;
