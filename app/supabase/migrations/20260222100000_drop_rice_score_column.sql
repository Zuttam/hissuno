-- Drop the rice_score column from issues table.
-- RICE score is now computed on-the-fly from (reach * impact * confidence) / effort.
DROP INDEX IF EXISTS idx_issues_rice_score;
ALTER TABLE issues DROP COLUMN IF EXISTS rice_score;
