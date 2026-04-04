---
title: "CLI"
description: "Query and manage your Hissuno project data from the terminal."
---

## Overview

The Hissuno CLI (`hissuno`) lets you interact with your Hissuno instance from the terminal - set up new instances, configure connections, query feedback, manage issues, connect integrations, and more.

> **Note:** The CLI connects to an existing Hissuno server. If you haven't set one up yet, run `npm i -g hissuno && hissuno setup` first.

## Installation

Install globally:

```bash
npm i -g hissuno
```

## Setup

Run `hissuno setup` to create a new Hissuno instance from scratch:

```bash
hissuno setup
```

This handles cloning the repository, installing dependencies, configuring PostgreSQL, pushing the database schema, and optionally seeding demo data.

### Running specific steps

Resume from a specific step (runs that step and everything after):

```bash
hissuno setup --from seed
```

Run only specific steps:

```bash
hissuno setup --only seed,start
```

Available steps: `check-node`, `clone`, `install`, `build`, `postgres`, `env`, `database`, `seed`, `config`, `start`.

### Setting up OAuth integrations

To enable OAuth-based integrations (Slack, GitHub, Jira, Linear, Intercom), you need to add their client credentials to your `.env.local`. The `setup oauth` command handles this:

```bash
# Interactive - prompts for platform and credentials
hissuno setup oauth

# Specify the platform
hissuno setup oauth slack

# Non-interactive
hissuno setup oauth slack --client-id YOUR_ID --client-secret YOUR_SECRET

# GitHub uses App credentials instead of OAuth client ID/secret
hissuno setup oauth github --app-slug your-app --app-id 12345 --private-key BASE64_KEY
```

After adding credentials, restart the server (`npm run dev`) for the integration to become available. Then connect it with `hissuno integrations add <platform>`.

## Config

Run `hissuno config` to configure your API key and endpoint:

```bash
hissuno config
```

You will be prompted for:

1. **API key** - your Hissuno API key (starts with `hiss_`). Generate one on the **Access** page in your project settings. See [API Authentication](/docs/api/authentication).
2. **Hissuno URL** - defaults to `http://localhost:3000`

The configuration is saved to `~/.hissuno/config.json`.

## Status

Check your connection health:

```bash
hissuno status
```

## Commands

### `hissuno types`

List all available resource types with their supported filters and fields.

```bash
hissuno types
```

### `hissuno list <type>`

List resources of a given type with optional filters.

```bash
# List all issues
hissuno list issues

# List open bugs
hissuno list issues --issue-type bug --status open

# List feedback from Slack
hissuno list feedback --source slack

# List contacts at a company
hissuno list contacts --company-id <id>

# Limit results
hissuno list feedback --limit 5
```

**Filter flags by resource type:**

| Type | Flags |
|------|-------|
| feedback | `--source`, `--status`, `--tags`, `--contact-id`, `--search`, `--limit` |
| issues | `--issue-type`, `--priority`, `--status`, `--search`, `--limit` |
| contacts | `--search`, `--company-id`, `--role`, `--limit` |
| knowledge | `--limit` |

### `hissuno get <type> <id>`

Get full details of a specific resource.

```bash
hissuno get issues abc123
hissuno get feedback def456
```

### `hissuno search <query>`

Semantic search across all resources using natural language.

```bash
# Search everything
hissuno search "checkout flow bugs"

# Search within a specific type
hissuno search "onboarding complaints" --type feedback

# Limit results
hissuno search "authentication" --type issues --limit 5
```

### `hissuno add <type>`

Create a new resource interactively. Supported types: `feedback`, `issues`, `contacts`.

```bash
hissuno add issues     # Prompts for type, title, description, priority
hissuno add contacts   # Prompts for name, email, role, etc.
hissuno add feedback   # Prompts for messages, name, tags
```

Knowledge sources cannot be added via CLI — use the dashboard.

### `hissuno integrations`

Manage integrations from the CLI. Supports: `intercom`, `gong`, `zendesk`, `slack`, `github`, `jira`, `linear`, `fathom`, `hubspot`, `notion`.

```bash
# List all integrations with connection status
hissuno integrations list

# Interactive wizard for a specific integration
hissuno integrations gong

# Check detailed status
hissuno integrations status gong

# Connect a token-based integration
hissuno integrations add gong

# Connect with arguments (non-interactive)
hissuno integrations add gong --access-key=KEY --access-key-secret=SECRET --base-url=https://api.gong.io --sync-frequency=24h

# Connect an OAuth integration (opens browser)
hissuno integrations add slack

# Connect Fathom with an API key
hissuno integrations add fathom --api-key=KEY --sync-frequency=24h

# Connect HubSpot with a private app token
hissuno integrations add hubspot --access-token=TOKEN --overwrite-policy=fill_nulls

# Connect Notion with an internal integration token
hissuno integrations add notion --access-token=TOKEN

# Update sync settings
hissuno integrations configure intercom

# Trigger a manual sync
hissuno integrations sync gong
hissuno integrations sync intercom --mode full

# Disconnect an integration
hissuno integrations disconnect zendesk
```

**Token-based integrations** (Gong, Zendesk, Fathom) can be connected directly from the CLI by providing API credentials. The CLI validates credentials against the platform API before saving.

**OAuth integrations** (Slack, GitHub, Jira, Linear) open your browser to complete the authorization flow. You must be logged into the Hissuno dashboard in your browser.

**Hybrid integrations** (Intercom, HubSpot, Notion) support both token and OAuth - choose interactively or pass `--access-token` for the token flow.

**Connect flags by platform:**

| Platform | Flags |
|----------|-------|
| Gong | `--access-key`, `--access-key-secret`, `--base-url`, `--sync-frequency` |
| Zendesk | `--subdomain`, `--email`, `--api-token`, `--sync-frequency` |
| Intercom | `--access-token`, `--sync-frequency` |
| Fathom | `--api-key`, `--sync-frequency` |
| HubSpot | `--access-token`, `--sync-frequency`, `--overwrite-policy` |
| Notion | `--access-token` |
| Slack, GitHub, Jira, Linear | (OAuth - no flags needed) |

**Sync flags:**

| Flag | Values |
|------|--------|
| `--mode` | `incremental` (default), `full` |

Sync is available for Intercom, Gong, Zendesk, Fathom, and HubSpot. The CLI streams sync progress in real-time.

## JSON Output

Add the `--json` flag to any command to get structured JSON output, useful for scripting and piping:

```bash
hissuno --json list issues --status open
hissuno --json search "login errors"
```

## Examples

**Check for bugs before a release:**

```bash
hissuno list issues --issue-type bug --status open --priority high
```

**Find what customers say about a feature:**

```bash
hissuno search "dark mode" --type feedback
```

**Log a bug from the terminal:**

```bash
hissuno add issues
```

**Export feedback to a file:**

```bash
hissuno --json list feedback --source widget --limit 50 > feedback.json
```
