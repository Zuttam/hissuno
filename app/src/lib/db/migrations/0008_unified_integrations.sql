-- Unified integration plugin infrastructure: new tables.
-- Legacy per-integration tables remain in place during M3-M5 migration.
-- Backfill from legacy tables + drop legacy tables run in later migrations.

CREATE TABLE IF NOT EXISTS "integration_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "plugin_id" text NOT NULL,
  "external_account_id" text NOT NULL,
  "account_label" text NOT NULL,
  "credentials" jsonb NOT NULL,
  "settings" jsonb,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "integration_connections_unique"
    UNIQUE ("project_id", "plugin_id", "external_account_id")
);

CREATE INDEX IF NOT EXISTS "idx_integration_connections_project"
  ON "integration_connections" ("project_id");
CREATE INDEX IF NOT EXISTS "idx_integration_connections_plugin"
  ON "integration_connections" ("plugin_id");

CREATE TABLE IF NOT EXISTS "integration_streams" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "connection_id" uuid NOT NULL REFERENCES "integration_connections"("id") ON DELETE CASCADE,
  "plugin_id" text NOT NULL,
  "stream_id" text NOT NULL,
  "stream_kind" text NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "frequency" text DEFAULT 'manual' NOT NULL,
  "filter_config" jsonb,
  "settings" jsonb,
  "last_sync_at" timestamp,
  "last_sync_status" text,
  "last_sync_error" text,
  "last_sync_counts" jsonb,
  "next_sync_at" timestamp,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "integration_streams_unique"
    UNIQUE ("connection_id", "stream_id")
);

CREATE INDEX IF NOT EXISTS "idx_integration_streams_connection"
  ON "integration_streams" ("connection_id");
CREATE INDEX IF NOT EXISTS "idx_integration_streams_due"
  ON "integration_streams" ("enabled", "frequency", "next_sync_at");

CREATE TABLE IF NOT EXISTS "integration_sync_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "connection_id" uuid NOT NULL REFERENCES "integration_connections"("id") ON DELETE CASCADE,
  "plugin_id" text NOT NULL,
  "stream_id" text,
  "triggered_by" text NOT NULL,
  "status" text DEFAULT 'in_progress' NOT NULL,
  "counts" jsonb,
  "error_message" text,
  "started_at" timestamp DEFAULT now(),
  "completed_at" timestamp
);

CREATE INDEX IF NOT EXISTS "idx_integration_sync_runs_connection"
  ON "integration_sync_runs" ("connection_id");
CREATE INDEX IF NOT EXISTS "idx_integration_sync_runs_started"
  ON "integration_sync_runs" ("started_at");

CREATE TABLE IF NOT EXISTS "integration_synced_records" (
  "connection_id" uuid NOT NULL REFERENCES "integration_connections"("id") ON DELETE CASCADE,
  "stream_id" text NOT NULL,
  "external_id" text NOT NULL,
  "hissuno_id" text NOT NULL,
  "hissuno_kind" text NOT NULL,
  "synced_at" timestamp DEFAULT now(),
  CONSTRAINT "integration_synced_records_pk"
    UNIQUE ("connection_id", "stream_id", "external_id")
);

CREATE INDEX IF NOT EXISTS "idx_integration_synced_records_connection"
  ON "integration_synced_records" ("connection_id");
