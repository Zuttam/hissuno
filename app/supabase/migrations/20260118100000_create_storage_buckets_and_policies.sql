-- Create storage buckets and RLS policies for knowledge and documents
-- This migration ensures buckets exist on remote Supabase projects

-- ============================================
-- CREATE BUCKETS
-- ============================================

-- Knowledge bucket (for AI-generated knowledge packages)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'knowledge',
  'knowledge',
  false,
  10485760,
  ARRAY['text/markdown', 'text/plain']
)
ON CONFLICT (id) DO NOTHING;

-- Documents bucket (for user-uploaded files)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  52428800,
  ARRAY['application/pdf', 'text/markdown', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- KNOWLEDGE BUCKET POLICIES
-- ============================================

-- Drop existing policy if it exists (from earlier migration)
DROP POLICY IF EXISTS "Users can read knowledge for their projects" ON storage.objects;

-- Users can read knowledge files for their projects
-- (Uploads are done via service role, so no INSERT policy needed)
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

-- ============================================
-- DOCUMENTS BUCKET POLICIES
-- ============================================

-- Users can upload documents to their projects
CREATE POLICY "Users can upload documents to their projects"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id::text = (storage.foldername(objects.name))[1]
    AND projects.user_id = auth.uid()
  )
);

-- Users can read documents from their projects
CREATE POLICY "Users can read documents from their projects"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id::text = (storage.foldername(objects.name))[1]
    AND projects.user_id = auth.uid()
  )
);

-- Users can delete documents from their projects
CREATE POLICY "Users can delete documents from their projects"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id::text = (storage.foldername(objects.name))[1]
    AND projects.user_id = auth.uid()
  )
);
