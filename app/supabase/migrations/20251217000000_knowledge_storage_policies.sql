-- RLS policies for knowledge storage bucket
-- Users can only access files under projects they own
-- Storage path format: {projectId}/{category}-v{version}.md

-- Select: users can read knowledge files for their projects
CREATE POLICY "Users can read knowledge for their projects"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'knowledge' AND
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id::text = (storage.foldername(objects.name))[1]
    AND projects.user_id = auth.uid()
  )
);
