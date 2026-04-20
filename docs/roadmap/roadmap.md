# Roadmap

Upcoming features and improvements for Hissuno. Each plan links to a detailed design document in `plans/` with architecture, implementation steps, and verification criteria.

| Plan | Status | Description |
|------|--------|-------------|
| [Google Drive Knowledge Integration](plans/google-drive-knowledge-integration.md) | Planned | Integrate Google Drive as a knowledge source type for bulk document import |
| [Jira/Linear Issue Import](plans/jira-linear-issue-import.md) | Partial | OAuth connection and configuration UI done for both. Issue import pipeline (sync, dedup, mapping, feedback matching) not started |
| CLI Feature Parity | Planned | Uplift CLI (8->13 commands) with update/archive, workflow triggers, companies, and ask |
| [Multi-Provider Model Support](plans/multi-provider-model-support.md) | Planned | Configure AI provider and model per agent via env vars with tier-based fallbacks |
| [Multi-Instance Integrations](plans/multi-instance-integrations.md) | Planned | Support multiple connections of the same integration type per project (e.g., two Fathom accounts) |
| [Agent Identity](plans/agent-identity.md) | Planned | Agent registry with token linkage for traceable agent-as-identity under user scope (depends on Audit Trail) |
| [Autonomous Development Loop](plans/autonomous-development-loop.md) | Planned | Close the brief-to-PR gap: orchestrator picks prioritized issues, triggers Claude Code via GitHub Actions, monitors CI, tracks full development lifecycle |
| [Third-Party Plugins](plans/third-party-plugins.md) | Planned | Extract `@hissuno/plugin-kit`, make the integration registry pluggable, and scaffold external plugin packages via the CLI |
