-- Add analysis_scope column to source_codes table
-- This allows scoping codebase analysis to a specific path prefix (e.g., for monorepos)

ALTER TABLE public.source_codes
  ADD COLUMN IF NOT EXISTS analysis_scope text;

-- Add comment for documentation
COMMENT ON COLUMN public.source_codes.analysis_scope IS 'Optional path prefix to scope codebase analysis (e.g., packages/my-app for monorepos)';



