-- Migration: Fix knowledge_sources FK cascade behavior
-- Problem: ON DELETE SET NULL violates check constraint that requires source_code_id for codebase type
-- Solution: Change to ON DELETE CASCADE so knowledge_source is deleted with source_code

-- Step 1: Drop the existing constraint
ALTER TABLE public.knowledge_sources
  DROP CONSTRAINT IF EXISTS knowledge_sources_source_code_id_fkey;

-- Step 2: Re-add with CASCADE behavior
ALTER TABLE public.knowledge_sources
  ADD CONSTRAINT knowledge_sources_source_code_id_fkey
  FOREIGN KEY (source_code_id)
  REFERENCES public.source_codes(id)
  ON DELETE CASCADE;

COMMENT ON CONSTRAINT knowledge_sources_source_code_id_fkey ON public.knowledge_sources
  IS 'Cascades delete: when source_code is deleted, the codebase knowledge_source is also deleted';
