# Roadmap

Upcoming features and improvements for Hissuno. Each plan links to a detailed design document in `plans/` with architecture, implementation steps, and verification criteria.

| Plan | Status | Description |
|------|--------|-------------|
| [Google Drive Knowledge Integration](plans/google-drive-knowledge-integration.md) | Planned | Integrate Google Drive as a knowledge source type for bulk document import |
| [Jira/Linear Issue Import](plans/jira-linear-issue-import.md) | Partial | OAuth connection and configuration UI done for both. Issue import pipeline (sync, dedup, mapping, feedback matching) not started |
| [Agent Identity](plans/agent-identity.md) | Planned | Agent registry with token linkage for traceable agent-as-identity under user scope (depends on Audit Trail) |
| [Autonomous Development Loop](plans/autonomous-development-loop.md) | Planned | Close the brief-to-PR gap: orchestrator picks prioritized issues, triggers Claude Code via GitHub Actions, monitors CI, tracks full development lifecycle |
| [Third-Party Plugins](plans/third-party-plugins.md) | Planned | Extract `@hissuno/plugin-kit`, make the integration registry pluggable, and scaffold external plugin packages via the CLI |
