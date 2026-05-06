-- Per-project toggles for cross-session chat agent memory.
-- Default off so existing projects keep their current behavior. When enabled,
-- the chat agent's Mastra working memory persists per contact (support) or
-- per user (PM) across sessions via the mastra.* schema.

ALTER TABLE project_settings
  ADD COLUMN IF NOT EXISTS support_agent_memory_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE project_settings
  ADD COLUMN IF NOT EXISTS product_agent_memory_enabled boolean NOT NULL DEFAULT false;
