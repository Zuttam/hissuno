-- Simplify source_codes table by removing unused columns
-- This migration removes label, description, and archive_temp_path columns
-- as part of the source code upload simplification

-- Remove unused columns
ALTER TABLE public.source_codes DROP COLUMN IF EXISTS label;
ALTER TABLE public.source_codes DROP COLUMN IF EXISTS description;
ALTER TABLE public.source_codes DROP COLUMN IF EXISTS archive_temp_path;

-- Update storage_uri comment to reflect new usage
COMMENT ON COLUMN public.source_codes.storage_uri IS 'Supabase storage bucket path for the codebase files.';

-- Add cascade delete so that when a project is deleted, its source_code is also deleted
-- First, check if the constraint already exists and drop it
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_source_code_id_fkey;

-- Add the foreign key with cascade delete
ALTER TABLE public.projects 
  ADD CONSTRAINT projects_source_code_id_fkey 
  FOREIGN KEY (source_code_id) 
  REFERENCES public.source_codes(id) 
  ON DELETE SET NULL;
