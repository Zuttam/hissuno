-- Add in-app notification support to user_notifications table
-- Adds dismissed_at for persistent dismissal, project_id for scoping

-- Add dismissed_at column (NULL = active, timestamp = dismissed)
ALTER TABLE public.user_notifications
ADD COLUMN IF NOT EXISTS dismissed_at timestamptz;

-- Add project_id column (nullable, scopes notifications to a project)
ALTER TABLE public.user_notifications
ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE;

-- Partial index for efficient inbox queries (undismissed in-app notifications)
CREATE INDEX IF NOT EXISTS user_notifications_inbox_idx
ON public.user_notifications(user_id, channel)
WHERE channel = 'in_app' AND dismissed_at IS NULL;

-- Index for project-scoped queries
CREATE INDEX IF NOT EXISTS user_notifications_project_idx
ON public.user_notifications(project_id)
WHERE project_id IS NOT NULL;

-- UPDATE RLS policy: users can update their own notifications (for dismissal)
CREATE POLICY "Users can update own notifications"
ON public.user_notifications FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
