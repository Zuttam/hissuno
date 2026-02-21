-- Rename velocity columns to reach
ALTER TABLE issues RENAME COLUMN velocity_score TO reach_score;
ALTER TABLE issues RENAME COLUMN velocity_reasoning TO reach_reasoning;

-- Add confidence columns
ALTER TABLE issues ADD COLUMN confidence_score integer NULL;
ALTER TABLE issues ADD COLUMN confidence_reasoning text NULL;
ALTER TABLE issues ADD COLUMN rice_score numeric NULL;

-- Add check constraint for confidence_score range
ALTER TABLE issues ADD CONSTRAINT issues_confidence_score_range CHECK (confidence_score IS NULL OR (confidence_score >= 1 AND confidence_score <= 5));

-- Drop old indexes (if they exist) and create new ones
DROP INDEX IF EXISTS idx_issues_velocity_score;
CREATE INDEX IF NOT EXISTS idx_issues_reach_score ON issues (reach_score);
CREATE INDEX IF NOT EXISTS idx_issues_confidence_score ON issues (confidence_score);
CREATE INDEX IF NOT EXISTS idx_issues_rice_score ON issues (rice_score);
