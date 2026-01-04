-- Migration: Remove storage_uri and switch to git-only codebase handling
-- This migration supports the architectural change from Supabase storage bucket
-- to ephemeral local git clones for codebase analysis.

-- Step 1: Delete existing uploaded codebases (kind='path')
-- These will no longer work with the new git-based approach
-- Users will need to connect GitHub repos for those projects

-- First, update projects that reference path-based source_codes to have null source_code_id
UPDATE public.projects
SET source_code_id = NULL
WHERE source_code_id IN (
  SELECT id FROM public.source_codes WHERE kind = 'path'
);

-- Also remove any knowledge_sources that reference path-based codebases
-- (the codebase source references the project, not the source_code directly,
-- but we should clean up orphaned codebase knowledge sources)
DELETE FROM public.knowledge_sources
WHERE type = 'codebase'
AND project_id IN (
  SELECT p.id FROM public.projects p
  JOIN public.source_codes sc ON p.source_code_id = sc.id
  WHERE sc.kind = 'path'
);

-- Delete the path-based source_codes records
DELETE FROM public.source_codes WHERE kind = 'path';

-- Step 2: Remove storage_uri column (no longer needed with git approach)
ALTER TABLE public.source_codes DROP COLUMN IF EXISTS storage_uri;

-- Step 3: Update kind constraint to only allow 'github'
-- First drop the existing constraint if any
ALTER TABLE public.source_codes DROP CONSTRAINT IF EXISTS source_codes_kind_check;

-- Add new constraint allowing only 'github'
ALTER TABLE public.source_codes ADD CONSTRAINT source_codes_kind_check
  CHECK (kind IN ('github'));

-- Step 4: Add helpful comment
COMMENT ON TABLE public.source_codes IS 'GitHub repository references for project codebases. Codebases are cloned to ephemeral local directories during analysis.';
COMMENT ON COLUMN public.source_codes.kind IS 'Source type - currently only github is supported';

-- Step 5: Clean up the codebases storage bucket (no longer needed)
-- First delete all objects in the bucket
DELETE FROM storage.objects WHERE bucket_id = 'codebases';

-- Drop the RLS policies for the codebases bucket
DROP POLICY IF EXISTS "Users can upload codebase files" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own codebase files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own codebase files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own codebase files" ON storage.objects;

-- Delete the bucket
DELETE FROM storage.buckets WHERE id = 'codebases';
