-- Remove analysis_scope from source_codes table
-- This column is now exclusively managed in knowledge_sources table for codebase sources
-- Migration: Move any existing data before dropping

-- First, migrate any existing analysis_scope values from source_codes to knowledge_sources
-- This ensures we don't lose any data during the migration
UPDATE public.knowledge_sources ks
SET analysis_scope = sc.analysis_scope
FROM public.source_codes sc
JOIN public.projects p ON p.source_code_id = sc.id
WHERE ks.project_id = p.id
  AND ks.type = 'codebase'
  AND sc.analysis_scope IS NOT NULL
  AND (ks.analysis_scope IS NULL OR ks.analysis_scope = '');

-- Now drop the column from source_codes
ALTER TABLE public.source_codes
  DROP COLUMN IF EXISTS analysis_scope;

-- Add a comment explaining the change
COMMENT ON COLUMN public.knowledge_sources.analysis_scope IS 'Path prefix to scope codebase analysis (e.g., packages/my-app for monorepos). Only applicable for type=codebase.';
