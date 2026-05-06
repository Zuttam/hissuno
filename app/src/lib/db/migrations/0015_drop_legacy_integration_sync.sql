-- Drop legacy plugin sync tables. Sync logic moved into automation skills
-- (src/lib/automations/skills/<plugin>-<stream>/), state lives on
-- automation_runs + automation_skill_state, and external→hissuno mapping
-- lives in external_records.

DROP TABLE IF EXISTS "integration_synced_records";
DROP TABLE IF EXISTS "integration_sync_runs";
DROP TABLE IF EXISTS "integration_streams";
