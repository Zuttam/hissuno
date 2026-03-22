# hissuno

Command-line interface for interacting with Hissuno - the unified context layer for product agents. Set up instances, traverse the knowledge graph, manage feedback and issues, search with natural language, and connect integrations - all from your terminal.

## Installation

```bash
npm install -g hissuno
```

Requires Node.js 20 or later.

## Quick Start

### New instance

Run the infrastructure wizard to set up everything from scratch:

```bash
npm i -g hissuno
hissuno setup
```

This clones the repository, installs dependencies, configures PostgreSQL with pgvector, pushes the schema, optionally seeds demo data, and auto-configures the CLI.

### Existing instance

Connect the CLI to a running Hissuno server:

```bash
hissuno config
```

This walks you through authentication, project detection, and optionally connecting data sources (Intercom, Gong, Slack, etc.).

Configuration is saved to `~/.hissuno/config.json`.

### Production deployment

Deploy Hissuno to a cloud provider (e.g. Vercel + Neon) and set up the database from your local machine.

**1. Set up your database and hosting**

Create a PostgreSQL database with pgvector enabled (e.g. [Neon](https://neon.tech), [Supabase](https://supabase.com)) and deploy the app to your hosting provider (e.g. [Vercel](https://vercel.com)). Set the required environment variables in your hosting dashboard:

- `DATABASE_URL` - your database connection string
- `AUTH_SECRET` - run `openssl rand -base64 32` to generate
- `NEXT_PUBLIC_APP_URL` - your deployment URL (e.g. `https://hissuno.example.com`)
- `OPENAI_API_KEY` - your OpenAI key

**2. Push schema and seed from your local machine**

```bash
cd hissuno/app

# Create .env.prod with your production DATABASE_URL and app URL, push schema, and seed
hissuno setup --only env,database,seed --app-dir . --env prod
```

When prompted, enter your production database URL and deployment URL.

**3. Connect the CLI to your production instance**

```bash
hissuno config
```

Enter your deployment URL and the API key from the seed output.

### Check connection

```bash
hissuno status
```

## Configuration

The CLI stores its configuration at `~/.hissuno/config.json`:

```json
{
  "api_key": "hiss_...",
  "base_url": "http://localhost:3000",
  "project_id": "your-project-id"
}
```

| Field | Description |
|-------|-------------|
| `api_key` | Your Hissuno API key (starts with `hiss_`) |
| `base_url` | Hissuno instance URL (default: `http://localhost:3000`) |
| `project_id` | Auto-detected on first use; cached for subsequent calls |

The project ID is resolved automatically from your API key on the first request and cached locally.

## Global Options

| Flag | Description |
|------|-------------|
| `--json` | Output raw JSON instead of formatted terminal output |
| `--version` | Print CLI version |
| `--help` | Show help for any command |

## Commands

### `hissuno setup`

Infrastructure wizard. Sets up a new Hissuno instance from scratch.

```bash
hissuno setup
```

#### Running specific steps

Resume from a specific step (runs that step and everything after):

```bash
hissuno setup --from seed
```

Run only specific steps (comma-separated):

```bash
hissuno setup --only seed,start
```

Available steps: `check-node`, `clone`, `install`, `build`, `postgres`, `env`, `database`, `seed`, `config`, `start`.

#### Target environment

Use `--env` to write to a specific env file. The file name is `.env.<environment>`:

```bash
# Writes to .env.prod
hissuno setup --env prod

# Writes to .env.staging
hissuno setup --env staging
```

Without `--env`, defaults to `.env.local`.

#### `hissuno setup oauth [platform]`

Configure OAuth credentials for an integration. Prompts for client ID and secret (or GitHub App credentials), writes them to `.env.local`, and tells you to restart the server.

```bash
# Interactive - prompts for which platform
hissuno setup oauth

# Specify the platform directly
hissuno setup oauth slack

# Non-interactive with flags
hissuno setup oauth slack --client-id YOUR_ID --client-secret YOUR_SECRET

# GitHub uses different credentials
hissuno setup oauth github \
  --app-slug your-app \
  --app-id 12345 \
  --private-key BASE64_KEY

# Custom app directory
hissuno setup oauth slack --app-dir ./my-hissuno/app
```

Supported platforms: `slack`, `github`, `jira`, `linear`, `intercom`.

| Option | Platform | Description |
|--------|----------|-------------|
| `--client-id <id>` | slack, jira, linear, intercom | OAuth client ID |
| `--client-secret <secret>` | slack, jira, linear, intercom | OAuth client secret |
| `--app-slug <slug>` | github | GitHub App slug |
| `--app-id <id>` | github | GitHub App ID |
| `--private-key <key>` | github | GitHub private key (base64-encoded) |
| `--app-dir <dir>` | all | Path to app directory (default: `./hissuno/app`) |

### `hissuno config`

Manual configuration wizard. Connects the CLI to an existing Hissuno instance.

```bash
hissuno config
```

### `hissuno status`

Check connection health.

```bash
hissuno status
```

### `hissuno list <type>`

List resources of a given type. Supported types: `knowledge`, `feedback`, `issues`, `contacts`.

```bash
# List recent feedback
hissuno list feedback

# List bugs with high priority
hissuno list issues --issue-type bug --priority high

# List contacts from a specific company
hissuno list contacts --company-id abc123

# List feedback from Intercom, limited to 5 results
hissuno list feedback --source intercom --limit 5

# Output as JSON for scripting
hissuno --json list issues
```

#### Filter options

| Option | Applies to | Description |
|--------|-----------|-------------|
| `--source <source>` | feedback | Filter by source: `widget`, `slack`, `intercom`, `gong`, `api`, `manual` |
| `--status <status>` | feedback, issues | Filter by status |
| `--tags <tags>` | feedback | Comma-separated tag filter |
| `--contact-id <id>` | feedback | Filter by contact ID |
| `--search <query>` | all | Text search filter |
| `--issue-type <type>` | issues | Filter by type: `bug`, `feature_request`, `change_request` |
| `--priority <priority>` | issues | Filter by priority: `low`, `medium`, `high` |
| `--company-id <id>` | contacts | Filter by company ID |
| `--role <role>` | contacts | Filter by role |
| `--limit <n>` | all | Max results (default: 20) |

### `hissuno get <type> <id>`

Get full details of a specific resource, including conversation messages for feedback.

```bash
# Get a feedback session with its full conversation
hissuno get feedback 550e8400-e29b-41d4-a716-446655440000

# Get an issue
hissuno get issues abc123

# Get a contact
hissuno get contacts def456

# Get a knowledge package
hissuno get knowledge pkg789

# Output as JSON
hissuno --json get issues abc123
```

Supported types: `knowledge`, `feedback`, `issues`, `contacts`.

### `hissuno search <query>`

Search across resources using natural language. Uses semantic vector search with full-text fallback.

```bash
# Search for checkout-related issues
hissuno search "checkout bugs"

# Search only within feedback
hissuno search "login problems" --type feedback

# Limit results
hissuno search "pricing page" --limit 5

# JSON output
hissuno --json search "onboarding flow"
```

| Option | Description |
|--------|-------------|
| `--type <type>` | Limit to one resource type: `knowledge`, `feedback`, `issues`, `contacts` |
| `--limit <n>` | Max results (default: 10) |

### `hissuno add <type>`

Interactively create a new resource. Supported types: `feedback`, `issues`, `contacts`.

Knowledge sources cannot be added via CLI - use the Hissuno dashboard instead.

```bash
# Create a new issue (interactive prompts for type, title, description, priority)
hissuno add issues

# Create a new contact (interactive prompts for name, email, role, etc.)
hissuno add contacts

# Create feedback with conversation messages
hissuno add feedback

# Output the created resource as JSON
hissuno --json add issues
```

#### Prompted fields by type

**issues** - type (bug / feature request / change request), title, description, priority (optional)

**contacts** - name, email, role (optional), title (optional), phone (optional), company ID (optional), champion flag

**feedback** - one or more conversation messages (role + content), name (optional), tags (optional)

### `hissuno integrations`

Manage third-party integrations. Supported platforms: `intercom`, `gong`, `zendesk`, `slack`, `github`, `jira`, `linear`, `fathom`, `hubspot`, `notion`.

```bash
# List all integrations with their connection status
hissuno integrations list

# Interactive wizard for a specific platform
hissuno integrations intercom

# Check detailed status
hissuno integrations status gong

# Connect a platform
hissuno integrations add slack

# Connect Gong with inline credentials (non-interactive)
hissuno integrations add gong \
  --access-key YOUR_KEY \
  --access-key-secret YOUR_SECRET \
  --sync-frequency 24h

# Connect Zendesk
hissuno integrations add zendesk \
  --subdomain mycompany \
  --email admin@mycompany.com \
  --api-token YOUR_TOKEN

# Connect Intercom with an API token
hissuno integrations add intercom --access-token YOUR_TOKEN

# Connect Fathom with an API key
hissuno integrations add fathom --api-key YOUR_KEY --sync-frequency 24h

# Connect HubSpot with a private app token
hissuno integrations add hubspot --access-token YOUR_TOKEN --overwrite-policy fill_nulls

# Connect Notion with an internal integration token
hissuno integrations add notion --access-token YOUR_TOKEN

# Update sync settings
hissuno integrations configure intercom

# Trigger a manual sync
hissuno integrations sync gong
hissuno integrations sync zendesk --mode full

# Disconnect an integration
hissuno integrations disconnect github

# JSON output
hissuno --json integrations list
```

#### Subcommands

| Subcommand | Args | Description |
|------------|------|-------------|
| `list` | | List all integrations with connection status |
| `add` | `<platform>` | Connect a platform (OAuth or token-based) |
| `status` | `<platform>` | Show detailed connection status |
| `configure` | `<platform>` | Update settings (sync frequency, auto-sync toggle) |
| `sync` | `<platform>` | Trigger a manual sync (Intercom, Gong, Zendesk, Fathom, HubSpot) |
| `disconnect` | `<platform>` | Disconnect the integration |

#### Connection options (for `add`)

| Option | Platform | Description |
|--------|----------|-------------|
| `--access-key <key>` | Gong | Access key |
| `--access-key-secret <secret>` | Gong | Access key secret |
| `--base-url <url>` | Gong | Base URL (default: `https://api.gong.io`) |
| `--subdomain <subdomain>` | Zendesk | Zendesk subdomain |
| `--email <email>` | Zendesk | Admin email |
| `--api-token <token>` | Zendesk | API token |
| `--access-token <token>` | Intercom, HubSpot, Notion | Access token |
| `--api-key <key>` | Fathom | API key |
| `--overwrite-policy <policy>` | HubSpot | `fill_nulls`, `hubspot_wins`, `never_overwrite` |
| `--sync-frequency <freq>` | Gong, Zendesk, Intercom, Fathom, HubSpot | Sync frequency: `manual`, `1h`, `6h`, `24h` |
| `--mode <mode>` | `sync` subcommand | Sync mode: `incremental` (default), `full` |

OAuth-based platforms (Slack, GitHub, Jira, Linear) open your browser to complete authorization. HubSpot, Intercom, and Notion support both OAuth and token-based authentication.

### `hissuno types`

Print documentation for all resource types, including available filters and fields.

```bash
hissuno types

# JSON output
hissuno --json types
```

## JSON Mode

Pass `--json` before the command name to get raw JSON output, useful for scripting and piping to other tools:

```bash
hissuno --json list issues | jq '.issues[] | .title'
hissuno --json search "auth errors" | jq '.results'
hissuno --json integrate gong status
```

## License

MIT
