-- Add impact analysis and effort estimation columns to issues table

-- Impact analysis fields
ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS affected_areas text[] DEFAULT '{}';

ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS impact_score integer DEFAULT NULL
    CHECK (impact_score IS NULL OR (impact_score >= 1 AND impact_score <= 5));

ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS impact_analysis jsonb DEFAULT NULL;

-- Effort estimation fields
ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS effort_estimate text DEFAULT NULL
    CHECK (effort_estimate IS NULL OR effort_estimate IN ('trivial', 'small', 'medium', 'large', 'xlarge'));

ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS effort_reasoning text DEFAULT NULL;

ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS affected_files text[] DEFAULT '{}';

-- Add comments for documentation
COMMENT ON COLUMN public.issues.affected_areas IS 'Knowledge categories/components affected by this issue';
COMMENT ON COLUMN public.issues.impact_score IS 'System-wide impact score 1-5 based on affected areas';
COMMENT ON COLUMN public.issues.impact_analysis IS 'Detailed impact analysis JSON from knowledge search';
COMMENT ON COLUMN public.issues.effort_estimate IS 'Estimated effort: trivial (<1hr), small (1-4hr), medium (1-2d), large (3-5d), xlarge (1w+)';
COMMENT ON COLUMN public.issues.effort_reasoning IS 'Explanation of effort estimate';
COMMENT ON COLUMN public.issues.affected_files IS 'Predicted files/components that may need changes';

-- Index for filtering by impact
CREATE INDEX IF NOT EXISTS issues_impact_score_idx ON public.issues (impact_score)
  WHERE impact_score IS NOT NULL;

-- Index for filtering by effort
CREATE INDEX IF NOT EXISTS issues_effort_estimate_idx ON public.issues (effort_estimate)
  WHERE effort_estimate IS NOT NULL;
