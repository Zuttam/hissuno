# Hissuno CLI Reference

Complete command reference for the `hissuno` CLI.

## Global Options

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON instead of formatted markdown |
| `-V, --version` | Show version number |
| `-h, --help` | Show help |

---

## Commands

### `hissuno setup`

Infrastructure wizard. Sets up a new Hissuno instance from scratch:
1. Check prerequisites (Node.js 20+, git)
2. Clone repository
3. Install dependencies and build widget
4. Detect/install PostgreSQL with pgvector
5. Configure `.env.local`
6. Push database schema
7. Seed demo data (optional)
8. Auto-configure CLI (optional)
9. Start the server

```bash
npm i -g hissuno
hissuno setup
```

---

### `hissuno config`

Manual configuration wizard. Connects the CLI to an existing Hissuno instance:
1. **Authentication** - enter your API key and Hissuno URL (default: `http://localhost:3000`)
2. **Project** - auto-detects the project associated with your API key
3. **Data sources** - optionally connect integrations (Intercom, Gong, Slack, etc.)

```bash
hissuno config
```

Saves configuration to `~/.hissuno/config.json`.

---

### `hissuno config show`

Display current configuration (active profile, API key, URL, project).

```bash
hissuno config show
hissuno config show --json
```

Shows the active profile name, masked API key, base URL, and project ID.

---

### `hissuno profile`

Manage multiple CLI profiles for different Hissuno instances or projects.

```bash
hissuno profile list              # List all profiles (* marks active)
hissuno profile use <name>        # Switch active profile
hissuno profile create <name>     # Create a new profile via config wizard
hissuno profile delete <name>     # Remove a profile
```

**Subcommands:**

| Subcommand | Args | Description |
|------------|------|-------------|
| `list` | | List all profiles with active indicator |
| `use` | `<name>` (required) | Switch to a different profile |
| `create` | `<name>` (required) | Run config wizard and save as a named profile |
| `delete` | `<name>` (required) | Remove a profile (cannot delete the active profile) |

Profiles are stored in `~/.hissuno/config.json` under a `profiles` key.

---

### `hissuno skills`

Install Hissuno skills (SKILL.md + references) into agent environments.

```bash
hissuno skills install              # Install to ~/.claude/skills/hissuno/
hissuno skills install --cursor     # Install to ~/.cursor/skills/hissuno/
hissuno skills install --path <dir> # Install to a custom directory
hissuno skills install --force      # Overwrite without prompting
hissuno skills uninstall            # Remove from default location
hissuno skills uninstall --cursor   # Remove from Cursor location
hissuno skills status               # Check installation across known locations
```

**Subcommands:**

| Subcommand | Description |
|------------|-------------|
| `install` | Copy bundled skills to an agent environment |
| `uninstall` | Remove installed skills |
| `status` | Show install state for Claude Code and Cursor locations |

**Install options:**

| Option | Description |
|--------|-------------|
| `--cursor` | Target `~/.cursor/skills/hissuno/` instead of Claude Code |
| `--path <dir>` | Target a custom directory (mutually exclusive with `--cursor`) |
| `--force` | Overwrite existing installation without confirmation |

---

### `hissuno status`

Check connection health. Verifies the CLI can reach the configured Hissuno instance.

```bash
hissuno status
```

---

### `hissuno types`

List all available resource types with their filters and fields.

```bash
hissuno types
hissuno types --json
```

---

### `hissuno list <type>`

List resources with optional filters.

```bash
hissuno list feedback
hissuno list issues --status open --priority high
hissuno list customers --search "john" --limit 5
hissuno list customers --customer-type companies --stage active
hissuno list scopes
hissuno list knowledge                  # Defaults to the project root scope
hissuno list knowledge --scope auth
hissuno list codebases
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `type` | `feedback`, `issues`, `customers`, `scopes`, `knowledge`, `codebases` |

> **Note:** `knowledge` is namespaced under a product scope. Without `--scope` the project's default (root) scope is used.

**Options (feedback):**
| Option | Description |
|--------|-------------|
| `--source <source>` | `widget`, `slack`, `intercom`, `gong`, `api`, `manual` |
| `--status <status>` | `active`, `closing_soon`, `awaiting_idle_response`, `closed` |
| `--tags <tags>` | Comma-separated tag list |
| `--contact-id <id>` | Filter by contact UUID |
| `--search <query>` | Text search |

**Options (issues):**
| Option | Description |
|--------|-------------|
| `--issue-type <type>` | `bug`, `feature_request`, `change_request` |
| `--priority <priority>` | `low`, `medium`, `high` |
| `--status <status>` | `open`, `ready`, `in_progress`, `resolved`, `closed` |
| `--search <query>` | Text search |

**Options (customers):**
| Option | Description |
|--------|-------------|
| `--customer-type <type>` | `contacts` (default) or `companies` |
| `--search <query>` | Search by name or email (contacts) / name or domain (companies) |
| `--company-id <id>` | Filter contacts by company UUID |
| `--role <role>` | Filter contacts by role |
| `--stage <stage>` | Filter companies by stage (`prospect`, `onboarding`, `active`, `churned`, `expansion`) |
| `--industry <industry>` | Filter companies by industry |

**Options (scopes):**
No type-specific filters. Use `--limit` to control result count.

**Options (knowledge):**
| Option | Description |
|--------|-------------|
| `--scope <id>` | Optional. Lists knowledge entries attached to this product scope. Defaults to the project's root scope when omitted. |

**Options (codebases):**
No type-specific filters.

**Common options:**
| Option | Description |
|--------|-------------|
| `--limit <n>` | Max results (default: 20) |

---

### `hissuno get <type> <id>`

Get full details of a specific resource, including all graph relationships.

```bash
hissuno get issues abc-123
hissuno get feedback def-456 --json
hissuno get customers ghi-789
hissuno get customers xyz-456 --customer-type companies
hissuno get scopes jkl-012
hissuno get codebase mno-345
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `type` | `feedback`, `issues`, `customers`, `scopes`, `codebase` |
| `id` | Resource UUID |

**Options:**
| Option | Description |
|--------|-------------|
| `--customer-type <type>` | For `customers` type: `contacts` (default) or `companies` |

The `get` command also fetches and displays all related entities (companies, contacts, issues, feedback sessions, source documents, codebases, product scopes) for the requested resource.

> **Note:** Individual knowledge entries are accessed through their owning scope - run `hissuno get scopes <id>` to see linked knowledge, or `hissuno list knowledge [--scope <id>]`.

---

### `hissuno search <query>`

Search across resources using natural language (semantic search).

```bash
hissuno search "checkout flow issues"
hissuno search "login failures" --type issues
hissuno search "payment" --type customers --limit 5 --json
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `query` | Natural language search query |

**Options:**
| Option | Description |
|--------|-------------|
| `--type <type>` | Limit to one type: `feedback`, `issues`, `customers`, `scopes`, `knowledge`, `codebase` |
| `--limit <n>` | Max results (default: 10) |

Note: `customers` search covers contacts only (companies don't have semantic search). Pass `--type knowledge` to search the body of scope-attached knowledge content.

---

### `hissuno add <type>`

Create a new resource interactively. Prompts for required fields.

```bash
hissuno add issues      # Create a bug, feature request, or change request
hissuno add customers   # Create a contact or company (prompts for sub-type)
hissuno add customers --customer-type companies  # Create a company directly
hissuno add feedback    # Log a feedback session
hissuno add scopes      # Create a product scope with optional goals
hissuno add knowledge --type <type> [--scope <id>]  # Attach a knowledge entry (defaults to the root scope)
hissuno add codebase --repo <url> --branch <name> [--scope <slug>]  # Connect a GitHub repo
```

**Supported types:** `issues`, `customers`, `feedback`, `scopes`, `knowledge`, `codebase`

> **Note:** `knowledge` is scope-namespaced. When `--scope` is omitted, the entry is attached to the project's default (root) scope.

**Interactive prompts by type:**

**issues:**
- Type (bug / feature request / change request)
- Title
- Description
- Priority (optional: low / medium / high)

**customers (contacts):**
- Name
- Email
- Role (optional)
- Title (optional)
- Phone (optional)
- Company ID (optional)
- Is champion? (optional)

**customers (companies):**
- Company name
- Domain (e.g., acme.com)
- Industry (optional)
- ARR (optional, number)
- Stage (optional: prospect / onboarding / active / churned / expansion)
- Employee count (optional, number)
- Plan tier (optional)
- Country (optional)
- Notes (optional)

**feedback:**
- Messages (loop: select role + enter content, empty to finish)
- Name/title (optional)
- Tags (optional, comma-separated)

**scopes:**
- Name
- Type (product_area / initiative)
- Description (optional)
- Goals (optional, loop: enter goal text, empty to finish, max 10)

**knowledge:**
- Type (`website` / `docs_portal` / `uploaded_doc` / `raw_text` / `notion`) - required
- Scope id via `--scope` - optional; defaults to the project's root scope
- Type-specific field (`--url` for website/docs_portal, `--content` for raw_text)

**codebase:**
- Repository URL (required via `--repo`)
- Branch (default `main`, override with `--branch`)
- Optional scope linkage via `--scope <slug>`
- Optional `--name`, `--description`, `--analysis-scope` (path prefix for monorepos)

---

### `hissuno update <type> <id>`

Update an existing resource interactively.

```bash
hissuno update scopes <id>
```

**Supported types:** `scopes`

**Interactive prompts (scopes):**
- Change name? (shows current)
- Change type? (shows current)
- Change description?
- Manage goals? (add new, replace all, clear all, or keep current)

---

### `hissuno integrations`

Manage integrations with external platforms.

**Supported platforms:** `intercom`, `gong`, `zendesk`, `slack`, `github`, `jira`, `linear`

```bash
hissuno integrations list                        # List all integrations with status
hissuno integrations <platform>                  # Interactive setup wizard
hissuno integrations status <platform>           # Detailed status
hissuno integrations add <platform>              # Connect (OAuth or token)
hissuno integrations configure <platform>        # Update settings
hissuno integrations sync <platform>             # Trigger manual sync
hissuno integrations disconnect <platform>       # Disconnect
```

**Subcommands:**

| Subcommand | Args | Description |
|------------|------|-------------|
| `list` | | List all integrations with connection status |
| `add` | `<platform>` | Connect a platform (OAuth or token-based) |
| `status` | `<platform>` | Show detailed connection status |
| `configure` | `<platform>` | Update settings (sync frequency, auto-sync toggle) |
| `sync` | `<platform>` | Trigger a manual sync (Intercom, Gong, Zendesk only) |
| `disconnect` | `<platform>` | Disconnect the integration |

**Platform-specific add options:**

| Option | Platforms | Description |
|--------|-----------|-------------|
| `--access-key <key>` | gong | Access key |
| `--access-key-secret <secret>` | gong | Access key secret |
| `--base-url <url>` | gong | Base URL (default: https://api.gong.io) |
| `--subdomain <sub>` | zendesk | Zendesk subdomain |
| `--email <email>` | zendesk | Admin email |
| `--api-token <token>` | zendesk | API token |
| `--access-token <token>` | intercom, hubspot, notion | Access token |
| `--api-key <key>` | fathom | API key |
| `--overwrite-policy <policy>` | hubspot | `fill_nulls`, `hubspot_wins`, `never_overwrite` |
| `--sync-frequency <freq>` | gong, zendesk, intercom, fathom, hubspot | `manual`, `1h`, `6h`, `24h` |
| `--mode <mode>` | sync subcommand | `incremental` (default) or `full` |

See `references/INTEGRATIONS.md` for full platform details.
