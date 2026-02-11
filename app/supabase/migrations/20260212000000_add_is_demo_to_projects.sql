-- Add is_demo flag to projects table
-- Demo projects are created during onboarding and don't count towards subscription limits

ALTER TABLE projects ADD COLUMN is_demo boolean DEFAULT false;

-- Index for billing queries that exclude demo projects
CREATE INDEX idx_projects_is_demo ON projects (is_demo) WHERE is_demo = true;
