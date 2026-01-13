-- Migration: Move source_code_id relationship from projects to knowledge_sources
-- This creates a cleaner model where source_code is accessed through knowledge_sources (type='codebase')

-- Step 1: Add source_code_id column to knowledge_sources
ALTER TABLE public.knowledge_sources
  ADD COLUMN IF NOT EXISTS source_code_id uuid REFERENCES public.source_codes(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.knowledge_sources.source_code_id IS 'Reference to source_codes record. Required for type=codebase, must be NULL for other types.';

-- Step 2: Migrate existing data (projects with source_code_id → their codebase knowledge_source)
UPDATE public.knowledge_sources ks
SET source_code_id = p.source_code_id
FROM public.projects p
WHERE ks.project_id = p.id
  AND ks.type = 'codebase'
  AND p.source_code_id IS NOT NULL
  AND ks.source_code_id IS NULL;

-- Step 3: Create missing codebase knowledge_sources for legacy projects
-- (Edge case: projects created before codebase-as-knowledge-source migration)
INSERT INTO public.knowledge_sources (project_id, type, source_code_id, status, enabled)
SELECT p.id, 'codebase', p.source_code_id, 'pending', true
FROM public.projects p
WHERE p.source_code_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.knowledge_sources ks
    WHERE ks.project_id = p.id AND ks.type = 'codebase'
  );

-- Step 4: Add check constraint
-- Ensures: codebase type MUST have source_code_id, other types MUST NOT have source_code_id
ALTER TABLE public.knowledge_sources
  ADD CONSTRAINT knowledge_sources_source_code_id_check
  CHECK (
    (type = 'codebase' AND source_code_id IS NOT NULL) OR
    (type != 'codebase' AND source_code_id IS NULL)
  );

-- Step 5: Create index for efficient lookups
CREATE INDEX IF NOT EXISTS knowledge_sources_source_code_id_idx
  ON public.knowledge_sources (source_code_id)
  WHERE source_code_id IS NOT NULL;

-- Step 6: Drop source_code_id from projects
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_source_code_id_fkey;
ALTER TABLE public.projects DROP COLUMN IF EXISTS source_code_id;
