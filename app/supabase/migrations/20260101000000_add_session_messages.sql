-- Add session_messages table for human agent messages
-- AI messages are stored in Mastra, this table is for human takeover messages

CREATE TABLE IF NOT EXISTS public.session_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('human_agent', 'system')),
  sender_user_id uuid REFERENCES auth.users(id),  -- Dashboard user who sent the message
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.session_messages OWNER TO postgres;

COMMENT ON TABLE public.session_messages IS 'Human agent and system messages for session takeover. AI messages are stored in Mastra.';
COMMENT ON COLUMN public.session_messages.sender_type IS 'Type of sender: human_agent (dashboard user) or system (automated message).';
COMMENT ON COLUMN public.session_messages.sender_user_id IS 'The dashboard user who sent the message (for human_agent type).';

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS session_messages_session_id_idx ON public.session_messages(session_id);
CREATE INDEX IF NOT EXISTS session_messages_created_at_idx ON public.session_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS session_messages_project_id_idx ON public.session_messages(project_id);

-- Enable RLS
ALTER TABLE public.session_messages ENABLE ROW LEVEL SECURITY;

-- Users can view messages for sessions in their projects
CREATE POLICY "Users can view session messages for their projects"
ON public.session_messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = session_messages.project_id
    AND projects.user_id = auth.uid()
  )
);

-- Users can insert messages for sessions in their projects
CREATE POLICY "Users can insert session messages for their projects"
ON public.session_messages FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = session_messages.project_id
    AND projects.user_id = auth.uid()
  )
);

-- Users can update messages for sessions in their projects
CREATE POLICY "Users can update session messages for their projects"
ON public.session_messages FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = session_messages.project_id
    AND projects.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = session_messages.project_id
    AND projects.user_id = auth.uid()
  )
);

-- Users can delete messages for sessions in their projects
CREATE POLICY "Users can delete session messages for their projects"
ON public.session_messages FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = session_messages.project_id
    AND projects.user_id = auth.uid()
  )
);
