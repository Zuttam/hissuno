-- RLS policies for codebases storage bucket
-- Users can only access files under their own userId folder
-- Storage path format: {userId}/{projectId}/{timestamp}/{relativePath}

-- Insert: users can upload to paths starting with their user_id
CREATE POLICY "Users can upload to their folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'codebases' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Select: users can read files under their user_id
CREATE POLICY "Users can read their files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'codebases' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Delete: users can delete files under their user_id
CREATE POLICY "Users can delete their files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'codebases' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Update: users can update files under their user_id
CREATE POLICY "Users can update their files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'codebases' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
