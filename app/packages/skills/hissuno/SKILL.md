---
name: hissuno
description: >
  Use when working with product intelligence data: searching knowledge, browsing feedback,
  tracking issues, managing customers (contacts and companies), organizing product scopes,
  traversing the knowledge graph, or connecting data sources via integrations.
  Works via the hissuno CLI.
license: MIT
compatibility: Requires network access to Hissuno API endpoint
metadata:
  author: hissuno
  version: "2.0"
---

# Hissuno Agent Skill

Hissuno is a unified context layer for product agents. It ingests codebases, docs, and customer signals (from chat widgets, Slack, Intercom, Gong, etc.) into an interconnected knowledge graph - knowledge sources, feedback sessions, product issues, customers (contacts and companies), and product scopes - all linked and traversable.

## Available Data

Hissuno exposes **5 resource types**:

| Type | CLI Type | What It Contains |
|------|----------|-----------------|
| **Knowledge** | `knowledge` | Analyzed knowledge sources (codebases, docs, URLs) - searchable via semantic vector search |
| **Feedback** | `feedback` | Customer feedback sessions - conversations with metadata, tags, and contact links |
| **Issues** | `issues` | Product issues - bugs, feature requests, and change requests with priority, status, and RICE scores |
| **Customers** | `customers` | Contacts (people) and companies (organizations) - use `--customer-type` to select |
| **Product Scopes** | `scopes` | Product areas and initiatives with measurable goals |

See individual reference files in `references/` for detailed filters, fields, and examples per type.

## The Knowledge Graph

All entity types are connected via universal edges. Any entity can link to any other entity. Run `hissuno get <type> <id>` to see all relationships for a resource in a single call. See `references/GRAPH-TRAVERSAL.md` for traversal patterns and multi-step query examples.

## Getting Started

Run `hissuno types` to see all available types, their filters, and creation fields.

## Configuration & Profiles

Connect the CLI and manage multiple environments:

```bash
hissuno config                      # Interactive setup wizard (API key, URL, project)
hissuno config show                 # Display active profile, URL, and project
hissuno profile list                # List all profiles (* marks active)
hissuno profile use <name>          # Switch active profile
hissuno profile create <name>       # Create a new profile via config wizard
hissuno profile delete <name>       # Remove a profile
```

Install Hissuno skills into agent environments:

```bash
hissuno skills install              # Install to ~/.claude/skills/hissuno/
hissuno skills install --cursor     # Install to ~/.cursor/skills/hissuno/
hissuno skills install --path <dir> # Install to a custom directory
hissuno skills status               # Check installation status across known locations
hissuno skills uninstall            # Remove installed skills
```

## When to Use Which Command

| Goal | Command | Example |
|------|---------|---------|
| Understand what data exists | `hissuno types` | "What can I access?" |
| Browse recent items | `hissuno list <type>` | "Show me open bugs" |
| Look up a specific item | `hissuno get <type> <id>` | "Get details for issue abc-123" |
| Find items by meaning | `hissuno search <query>` | "Find feedback about checkout flow" |
| Create new data | `hissuno add <type>` | "Log a bug about login failures" |
| Traverse relationships | `hissuno get <type> <id> --json` | "What companies are affected by this issue?" |
| Connect a data source | `hissuno integrations add <platform>` | "Connect Intercom" |
| View current connection | `hissuno config show` | "Which instance am I connected to?" |
| Switch environment | `hissuno profile use <name>` | "Switch to staging" |

Use `search` for semantic (meaning-based) matching. Use `list` when you want to browse with structured filters (status, priority, source, etc.).

## Common Workflows

### Investigate a Feature Area
1. `hissuno list scopes` to find the relevant product scope
2. `hissuno get scopes <id>` to see related issues, feedback, and knowledge
3. `hissuno get issues <id>` on specific issues for full details and RICE scores

### Find Customer Pain Points
1. `hissuno list feedback --source intercom --status closed` to see recent conversations
2. `hissuno search "the problem area"` across all types
3. Cross-reference with `hissuno list issues --status open` to check existing issues

### Log a Bug from Customer Feedback
1. `hissuno search "the problem" --type issues` to check for duplicates
2. If no duplicate: `hissuno add issues` with type=bug, title, description
3. Optionally reference the feedback session ID in the description

### Analyze a Customer Account
1. `hissuno list customers --customer-type companies --stage active` to find the company
2. `hissuno get customers <company-id> --customer-type companies` for company details and contacts
3. `hissuno list customers --company-id <id>` to find contacts at the company
4. Cross-reference with `hissuno list feedback --contact-id <id>` for full conversation history

### Assess Goal Progress
1. `hissuno list scopes` to find the scope
2. `hissuno get scopes <id>` to see goals and related issues
3. Review issue statuses and priorities to gauge progress toward each goal

### Switch Between Environments
1. `hissuno profile list` to see available profiles
2. `hissuno profile use <name>` to switch
3. `hissuno config show` to verify the active connection

### Connect a Data Source
1. `hissuno integrations list` to see all integration statuses
2. `hissuno integrations <platform>` to start the interactive setup wizard
3. For syncable platforms: `hissuno integrations sync <platform>` to trigger initial data pull

## CLI Reference

The `hissuno` CLI is the primary interface for Claude Code users. See `references/CLI-REFERENCE.md` for the full command reference.

Quick examples:
```bash
hissuno types                                    # List resource types
hissuno list issues --status open --priority high # Browse open high-priority issues
hissuno list customers                           # List contacts (default)
hissuno list customers --customer-type companies # List companies
hissuno list scopes                              # List product areas and initiatives
hissuno search "checkout flow"                   # Semantic search across all types
hissuno get feedback <id>                        # Full session detail + relationships
hissuno get customers <id>                       # Contact details + company relationship
hissuno add issues                               # Interactive issue creation
hissuno add scopes                               # Create a product scope with goals
hissuno update scopes <id>                       # Modify scope name, type, or goals
hissuno integrations list                         # List all integration statuses
hissuno integrations sync intercom               # Sync Intercom conversations
hissuno config show                              # View active connection
hissuno profile list                             # List profiles
hissuno profile use staging                      # Switch to staging profile
hissuno skills install                           # Install skills for Claude Code
```

## Product Workflows

Hissuno includes workflow skills that guide agents through structured product processes using the graph layer. Each is a standalone skill with its own trigger:

| Skill | Use When |
|-------|----------|
| `hissuno-market-analysis` | Analyzing a product area or initiative - demand, competitors, market context, feasibility |
| `hissuno-customer-health` | Assessing a customer account - feedback history, open issues, sentiment, health |

These are templates. To create your own workflow skill:

1. Create a new directory: `hissuno-<your-workflow-name>/`
2. Add a `SKILL.md` with frontmatter (`name`, `description` with trigger keywords) and your phased procedure
3. Use `hissuno` CLI commands in each step to query and enrich the graph
4. Run `hissuno skills install` to deploy

See any existing workflow skill's `SKILL.md` for the pattern.

## MCP Access (Alternative)

Everything above can also be accessed via MCP tools if you prefer structured tool calls over CLI. See `references/MCP-TOOLS.md` for setup and usage.
