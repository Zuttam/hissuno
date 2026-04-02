# Roadmap

Upcoming features and improvements for Hissuno. Each plan links to a detailed design document in `plans/` with architecture, implementation steps, and verification criteria.

| Plan | Status | Description |
|------|--------|-------------|
| [Google Drive Knowledge Integration](plans/google-drive-knowledge-integration.md) | Planned | Integrate Google Drive as a knowledge source type for bulk document import |
| [Jira/Linear Issue Import](plans/jira-linear-issue-import.md) | Planned | Import issues from Jira and Linear with feedback matching, embeddings, and incremental sync |
| [CLI & MCP Feature Parity](plans/cli-mcp-feature-parity.md) | Planned | Uplift CLI (8->13 commands) and MCP (6->17 tools) with update/archive, workflow triggers, companies, and ask |
| [Hissuno Setup Skill](plans/hissuno-setup-skill.md) | Planned | Claude Code skill for automated Neon + Vercel environment provisioning |
| [Multi-Provider Model Support](plans/multi-provider-model-support.md) | Planned | Configure AI provider and model per agent via env vars with tier-based fallbacks |
| [Multi-Instance Integrations](plans/multi-instance-integrations.md) | Planned | Support multiple connections of the same integration type per project (e.g., two Fathom accounts) |
| [Audit Trail](plans/audit-trail.md) | Planned | Append-only audit events table tracking which identity performed what action on which resource |
| [Agent Identity](plans/agent-identity.md) | Planned | Agent registry with token linkage for traceable agent-as-identity under user scope (depends on Audit Trail) |
| [Rename knowledge_package to support_package](plans/rename-knowledge-package-to-support-package.md) | Planned | Rename DB tables and code references to disambiguate support packages from general knowledge sources |
| [GitHub Issues as Feedback](plans/github-issues-as-feedback.md) | Planned | Extend GitHub integration to sync issues as feedback sessions, with multi-resource mapping pattern from Notion |
