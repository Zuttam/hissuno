-- Add codebase as a knowledge source type
-- This allows treating the project's codebase like any other knowledge source

-- Drop existing type constraint if it exists
ALTER TABLE public.knowledge_sources 
  DROP CONSTRAINT IF EXISTS knowledge_sources_type_check;

-- Add new constraint with 'codebase' type
ALTER TABLE public.knowledge_sources 
  ADD CONSTRAINT knowledge_sources_type_check 
  CHECK (type IN ('codebase', 'website', 'docs_portal', 'uploaded_doc', 'raw_text'));

-- Add analysis_scope column (for codebase sources - allows scoping to specific paths in monorepos)
ALTER TABLE public.knowledge_sources
  ADD COLUMN IF NOT EXISTS analysis_scope text;

-- Add enabled column (for toggle functionality - allows disabling sources without deleting)
ALTER TABLE public.knowledge_sources
  ADD COLUMN IF NOT EXISTS enabled boolean DEFAULT true;

-- Create unique partial index: only one codebase source per project
CREATE UNIQUE INDEX IF NOT EXISTS knowledge_sources_codebase_unique 
  ON public.knowledge_sources (project_id) 
  WHERE type = 'codebase';

-- Add comments
COMMENT ON COLUMN public.knowledge_sources.analysis_scope IS 'Optional path prefix to scope codebase analysis (e.g., packages/my-app for monorepos). Only used for codebase type.';
COMMENT ON COLUMN public.knowledge_sources.enabled IS 'Whether this source should be included in knowledge analysis. Defaults to true.';
