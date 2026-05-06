-- Durable per-(project, skill) state for skill scripts that need to persist
-- cursors, last-synced IDs, or other resumable state between runs. Survives
-- pruning of automation_runs.

CREATE TABLE IF NOT EXISTS "automation_skill_state" (
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "skill_id" text NOT NULL,
  "state" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "automation_skill_state_pkey" PRIMARY KEY ("project_id", "skill_id")
);
