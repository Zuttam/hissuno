-- Per-project automation skill settings (enable/disable + trigger overrides),
-- covering both bundled and custom skills uniformly. Replaces the bespoke
-- `enabled` column on custom_skills.

CREATE TABLE IF NOT EXISTS project_skill_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  skill_id text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  triggers jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT project_skill_settings_project_skill_idx UNIQUE (project_id, skill_id)
);

-- Backfill: any custom skill that was disabled gets a settings row with
-- enabled=false. Enabled custom skills don't need a row (default is true).
INSERT INTO project_skill_settings (project_id, skill_id, enabled)
SELECT project_id, skill_id, false
FROM custom_skills
WHERE enabled = false
ON CONFLICT (project_id, skill_id) DO NOTHING;

ALTER TABLE custom_skills DROP COLUMN IF EXISTS enabled;
