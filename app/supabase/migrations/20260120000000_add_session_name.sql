-- Add name column to sessions table for session naming/titles
ALTER TABLE public.sessions ADD COLUMN name text;

-- Add index on name for filtering/searching
CREATE INDEX sessions_name_idx ON public.sessions(name);
