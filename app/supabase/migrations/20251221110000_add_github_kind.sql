-- Update kind check constraint on source_codes table
-- Valid kinds: 'path' (folder upload) and 'github' (GitHub repository)
-- Note: 'upload' was in original schema but never used

-- Drop the existing check constraint
ALTER TABLE public.source_codes DROP CONSTRAINT IF EXISTS source_codes_kind_check;

-- Add the updated check constraint with correct values
ALTER TABLE public.source_codes 
  ADD CONSTRAINT source_codes_kind_check 
  CHECK (kind IN ('path', 'github'));

COMMENT ON COLUMN public.source_codes.kind IS 'Type of source code: path (folder upload to storage) or github (GitHub repository).';



