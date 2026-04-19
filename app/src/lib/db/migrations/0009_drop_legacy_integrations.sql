-- Drop all legacy per-integration tables now that the plugin-kit runtime owns
-- integration state via integration_connections / _streams / _sync_runs / _synced_records.
--
-- CASCADE is required because many of these have FK chains (sync_runs, synced_*).
-- Slack tables are kept: slack_workspace_tokens / slack_channels / slack_thread_sessions
-- back feature-specific channel + thread state that the generic plugin model
-- does not replicate.

DROP TABLE IF EXISTS "fathom_sync_runs" CASCADE;
DROP TABLE IF EXISTS "fathom_synced_meetings" CASCADE;
DROP TABLE IF EXISTS "fathom_connections" CASCADE;

DROP TABLE IF EXISTS "zendesk_sync_runs" CASCADE;
DROP TABLE IF EXISTS "zendesk_synced_tickets" CASCADE;
DROP TABLE IF EXISTS "zendesk_connections" CASCADE;

DROP TABLE IF EXISTS "intercom_sync_runs" CASCADE;
DROP TABLE IF EXISTS "intercom_synced_conversations" CASCADE;
DROP TABLE IF EXISTS "intercom_connections" CASCADE;

DROP TABLE IF EXISTS "gong_sync_runs" CASCADE;
DROP TABLE IF EXISTS "gong_synced_calls" CASCADE;
DROP TABLE IF EXISTS "gong_connections" CASCADE;

DROP TABLE IF EXISTS "posthog_sync_runs" CASCADE;
DROP TABLE IF EXISTS "posthog_connections" CASCADE;

DROP TABLE IF EXISTS "linear_issue_syncs" CASCADE;
DROP TABLE IF EXISTS "linear_connections" CASCADE;

DROP TABLE IF EXISTS "jira_issue_syncs" CASCADE;
DROP TABLE IF EXISTS "jira_connections" CASCADE;

DROP TABLE IF EXISTS "notion_issue_syncs" CASCADE;
DROP TABLE IF EXISTS "notion_sync_configs" CASCADE;
DROP TABLE IF EXISTS "notion_connections" CASCADE;

DROP TABLE IF EXISTS "hubspot_sync_runs" CASCADE;
DROP TABLE IF EXISTS "hubspot_synced_companies" CASCADE;
DROP TABLE IF EXISTS "hubspot_synced_contacts" CASCADE;
DROP TABLE IF EXISTS "hubspot_connections" CASCADE;

DROP TABLE IF EXISTS "github_synced_issues" CASCADE;
DROP TABLE IF EXISTS "github_sync_configs" CASCADE;
DROP TABLE IF EXISTS "github_app_installations" CASCADE;
