-- Plugin-agnostic external→hissuno mapping. Replaces integration_synced_records.
-- `source` is a free-form string (typically a plugin id like 'slack', 'linear');
-- `external_id` is the provider's stable id; `resource_type` identifies which
-- hissuno table `resource_id` points at.

CREATE TABLE IF NOT EXISTS "external_records" (
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "source" text NOT NULL,
  "external_id" text NOT NULL,
  "resource_type" text NOT NULL,
  "resource_id" uuid NOT NULL,
  "last_synced_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "external_records_pkey" PRIMARY KEY ("project_id", "source", "external_id", "resource_type")
);

CREATE INDEX IF NOT EXISTS "external_records_resource_idx" ON "external_records" ("resource_type", "resource_id");
