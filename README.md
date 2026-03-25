# Hissuno

**One intelligence layer. Every product agent.**

Hissuno is an open-source unified context layer for product agents. It ingests your codebase, docs, websites, and customer signals into an interconnected knowledge graph - then exposes it through agent-native interfaces (MCP, CLI, API) so any AI agent can traverse and query your product intelligence natively.

---

## The Problem

Product agents - support bots, coding assistants, sales copilots, internal tools - all need the same underlying context: your codebase, docs, customer history, feedback, and product knowledge. But today each agent has to build its own integrations to 10+ scattered sources. The result is fragmented, inconsistent, and expensive to maintain.

---

## The Solution

Hissuno solves this by building a single **interconnected knowledge graph** from your product data, where every entity - sessions, contacts, issues, scopes, knowledge sources - is connected. Agents don't just retrieve isolated facts; they traverse relationships to build real understanding.

### The Graph

Sessions link to contacts, contacts link to issues, issues link to scopes, scopes link back to code and docs. Every entity is connected through a unified relationship layer, so an agent can start from any node and navigate to the context it needs.

```
+-----------------------------------------------------------------+
|              ANY AI AGENT OR INTERFACE                           |
|  MCP Server | CLI | API | Widget | Slack | Claude | Cursor      |
+-------------------------------+---------------------------------+
                                |
                                v
           +--------------------------------------------+
           |         Hissuno Knowledge Graph            |
           |                                            |
           |     Knowledge <-> Scopes <-> Issues        |
           |          ^                     ^            |
           |          |                     |            |
           |     Sessions <-> Contacts -----+            |
           |                                            |
           +--------------------------------------------+
```

A support agent answering a customer question can traverse from the contact to their past sessions, to related issues, to the relevant codebase - assembling full context in one query. A coding agent can go from an issue to the customers who reported it, to their actual conversations, to understand the real problem before writing a line of code.

### Product Ontology: Scopes

Scopes are the organizational backbone of the graph - they define *what* your product is and give agents a structured understanding beyond raw data.

- **Areas** - Permanent product domains (e.g., "Auth System", "Analytics Dashboard", "Billing")
- **Initiatives** - Time-bound efforts (e.g., "Q1 Onboarding Revamp", "Performance Sprint")
- **Goals** - Specific objectives within a scope that entities can be classified against

Every entity in the graph - sessions, issues, knowledge sources - gets automatically linked to relevant scopes via graph evaluation. This means agents don't just see "a bug report" - they see "a bug report about the Auth System, related to the SSO Migration initiative, impacting the Reduce Login Friction goal."

### What Goes Into the Graph

When you set up a project, Hissuno analyzes your knowledge sources and builds the graph:

- **Source code** - GitHub repository or uploaded codebase
- **Websites** - Marketing site, documentation, landing pages
- **Documents** - PDFs, markdown files, wikis

These are compiled into searchable knowledge packages (`business`, `product`, `technical`) and connected to the rest of the graph.

### Continuous Enrichment

As customer conversations flow in, Hissuno's AI agents automatically enrich the graph:

1. **Classify** sessions (bug, feature request, general feedback, etc.)
2. **Link** sessions to contacts, scopes, and existing issues
3. **Create or upvote** issues with proper context and priority
4. **Generate briefs** when issues reach configurable thresholds

The graph gets richer with every interaction - and every agent benefits.

### How the Graph Builds Itself

Two mechanisms power automatic relationship discovery:

**Embeddings** - Every session, issue, contact, and knowledge chunk gets a 1536-dimension vector embedding (OpenAI). This enables semantic search across all entity types - finding related content by meaning, not just keywords. When graph evaluation runs, it uses these embeddings to find semantically similar entities across the entire graph.

**Graph Evaluation** - A 3-step AI pipeline that runs whenever a new entity enters the system:

1. **Extract Topics** - An LLM extracts 3-5 key topics from the entity's content
2. **Discover Relationships** - Six parallel strategies run simultaneously: semantic vector search against sessions, issues, knowledge, and contacts, plus text matching against scopes and companies
3. **Classify Goals** - When a scope match is found, an LLM classifies which specific goal the entity serves, storing the reasoning as relationship metadata

The result: every new piece of data automatically connects to the entities it relates to. A customer conversation about login failures gets linked to the Auth scope, similar bug reports, the relevant codebase sections, and the customer's company - all without manual triage.

---

## Built-In Intelligence

Hissuno isn't just a data layer - it ships with agents and automation flows that deliver value from day one.

### Support Agent

Customer-facing AI powered by your knowledge graph. Deploy via the embeddable widget or Slack.

- Answers grounded in your actual product knowledge (code, docs, past conversations)
- Automatically identifies contacts and links conversations to their history
- Configurable tone of voice, brand guidelines, and knowledge packages per project
- Real-time streaming responses via SSE

### Product Co-Pilot

Team-facing AI assistant for PMs, founders, and engineers.

- Available in-app (sidebar), via Slack, or through MCP (Claude Desktop, Cursor)
- Query issues, search feedback, explore the knowledge graph conversationally
- Full access to all project data with semantic search
- Record feedback on behalf of customers

### Automation Flows

**Feedback Triage** - When a customer session closes:
1. Classify the conversation (bug, feature request, general feedback)
2. Link to contact, scope, and related entities via graph evaluation
3. Find duplicate/similar issues via semantic search
4. AI decides: create new issue, upvote existing, or archive
5. Execute the decision with full context preserved

**Issue Analysis** - When an issue is created or upvoted:
1. Gather all linked sessions, contacts, and product context
2. Analyze technical impact and effort against the codebase
3. Compute priority scores (reach, impact, confidence, effort)
4. Generate a product brief when configurable thresholds are met

---

## Prerequisites

- **Node.js 20+** - [nodejs.org](https://nodejs.org)
- **PostgreSQL 15+** with the **pgvector** extension
- **OpenAI API key** - [platform.openai.com](https://platform.openai.com)

### PostgreSQL + pgvector Setup

Hissuno uses pgvector for semantic search. You need both PostgreSQL and the pgvector extension installed.

**Option A: Cloud provider (easiest)**

[Supabase](https://supabase.com), [Neon](https://neon.tech), and [Railway](https://railway.app) all include pgvector out of the box. Create a database and copy the connection string - no extra setup needed.

**Option B: Local install (macOS)**

```bash
brew install postgresql@15
brew install pgvector

# Start PostgreSQL
brew services start postgresql@15

# Create the database
createdb hissuno

# Enable pgvector
psql hissuno -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

**Option C: Local install (Linux)**

```bash
# Install PostgreSQL
sudo apt-get install postgresql-15

# Install pgvector (build from source)
cd /tmp
git clone --branch v0.8.0 https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install

# Create the database and enable pgvector
sudo -u postgres createdb hissuno
sudo -u postgres psql hissuno -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

---

## Quick Start

Install the CLI globally, then run setup - it handles PostgreSQL, environment, schema, and demo data:

```bash
npm i -g hissuno
hissuno setup
```

This will:
1. Clone the repository into `./hissuno`
2. Install dependencies and build the widget
3. Detect or install PostgreSQL with pgvector
4. Prompt for your OpenAI API key and generate `.env.local`
5. Push the database schema and optionally seed demo data
6. Start the server

Open [http://localhost:3000](http://localhost:3000) once it's running.

**If you seeded demo data:** log in with `admin@hissuno.com` / `AdminPass123!`

**If you skipped the seed:** click "Sign Up" to create your account.

### Interact with your instance

Once your server is running, use the CLI to create projects, manage data, and connect integrations:

```bash
hissuno config
```

See [CLI README](app/packages/cli/README.md) for full documentation.

### Manual Setup

If you prefer to set things up manually, see the [Prerequisites](#prerequisites) section above, then:

```bash
git clone https://github.com/hissuno/hissuno.git
cd hissuno/app
npm install
cp env.example .env.local
# Edit .env.local with your DATABASE_URL, OPENAI_API_KEY, AUTH_SECRET, etc.
npx drizzle-kit push
npm run db:seed    # optional
npm run dev
```

> **Note:** The seed credentials are for local development only. Change the password immediately if deploying to a shared environment.

### Remote Deployment (Vercel + Neon)

To deploy Hissuno to Vercel with a Neon database:

**1. Create a Neon database**

Create a project at [neon.tech](https://neon.tech) and enable the pgvector extension:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Copy your connection string (e.g. `postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/hissuno`).

**2. Deploy to Vercel**

Push the repo to GitHub and import into [Vercel](https://vercel.com). Set the root directory to `app/` and add these environment variables:

- `DATABASE_URL` - your Neon connection string
- `AUTH_SECRET` - run `openssl rand -base64 32` to generate
- `NEXT_PUBLIC_APP_URL` - your Vercel deployment URL (e.g. `https://hissuno.vercel.app`)
- `OPENAI_API_KEY` - your OpenAI key

**3. Push schema and seed from your local machine**

```bash
cd hissuno/app
npm install

# Configure env with your Neon DATABASE_URL and Vercel app URL
hissuno setup --only env,database,seed --app-dir . --env prod

# Point your CLI at the remote instance
hissuno config
```

When prompted, enter your Neon `DATABASE_URL` and your Vercel app URL (e.g. `https://hissuno.vercel.app`).

**4. Verify**

Open your Vercel URL and log in with the seeded credentials, or sign up for a new account.

---

## Architecture

### Tech Stack

- **Framework**: Next.js 16 (App Router, React 19)
- **Database**: PostgreSQL + Drizzle ORM + pgvector
- **Auth**: AuthJS v5 (next-auth) with Google OAuth + Credentials
- **AI Framework**: [Mastra](https://mastra.ai) - multi-agent orchestration
- **LLM**: OpenAI (gpt-5.4, GPT-5)
- **Storage**: Local filesystem (default) or S3-compatible
- **Knowledge Graph**: Unified `entity_relationships` table forming a traversable graph across sessions, issues, contacts, scopes, and knowledge sources
- **Integrations**: Slack, Intercom, Gong, Fathom, Zendesk, GitHub, Notion, Jira, Linear, HubSpot, PostHog, Widget, MCP

---

## Features

### Embeddable Widget

A React component for customer-facing applications:

```tsx
import { HissunoWidget } from '@hissuno/widget';

<HissunoWidget
  projectId="your-project-id"
  widgetToken={generatedToken}
  userId={currentUser.id}
  userMetadata={{ name: currentUser.name, email: currentUser.email }}
/>
```

- Two variants: `popup` (floating bubble) or `sidepanel` (slide-in)
- Real-time streaming responses via SSE
- Conversation history and session persistence
- Secure JWT authentication option
- Configurable allowed origins
- Light/dark/auto theme support

### Dashboard

- **Projects** - Create and configure projects, connect knowledge sources
- **Sessions** - View all customer conversations with filtering and search
- **Issues** - Track bugs and feature requests identified from sessions
- **Settings** - Widget configuration, issue thresholds, integrations

### Integrations

Connect your tools to feed data into the knowledge graph. 12 integrations available, organized by category:

| Category | Integrations | What It Brings In |
|----------|-------------|-------------------|
| **Interactive** | Widget, Slack | Live customer conversations, channel feedback |
| **Feedback** | Intercom, Gong, Fathom, Zendesk | Support tickets, call transcripts, meeting notes |
| **Knowledge** | GitHub, Notion | Codebase analysis, documentation pages |
| **Issues** | Jira, Linear | Two-way issue sync with project management |
| **Analytics** | PostHog | Behavioral profiles enriching contacts |
| **CRM** | HubSpot | Companies and contacts sync |

Coming soon: Gmail, Google Drive, Amplitude, Salesforce.

### MCP Server

Hissuno exposes an MCP (Model Context Protocol) server that lets external AI agents - Claude Desktop, Cursor, and other MCP clients - traverse the knowledge graph natively:

- **`ask_hissuno`** - Conversational tool: ask questions about your product, customers, issues, or feedback
- **`list_resources` / `get_resource` / `search_resources`** - Structured access to knowledge, feedback, issues, and contacts
- **`add_resource`** - Create new feedback, issues, or contacts programmatically

Two auth modes: **user mode** (full project access via API key) or **contact mode** (scoped to a single contact via widget token).

### CLI

A command-line interface for interacting with your Hissuno instance - create projects, query feedback, manage issues, connect integrations:

```bash
npm install -g hissuno
hissuno config
```

See [CLI README](app/packages/cli/README.md) for full documentation.

---

## Project Structure

```
app/
  src/
    app/                    # Next.js App Router
      (auth)/               # Login, signup pages
      (authenticated)/      # Dashboard pages
      api/                  # API routes
    components/             # React components
    hooks/                  # Custom React hooks
    lib/                    # Utilities and services
    mastra/                 # AI agents and workflows
      agents/               # Agent definitions
      tools/                # Agent tools
      workflows/            # Workflow definitions
    mcp/                    # MCP server
    types/                  # TypeScript types
  packages/
    widget/                 # @hissuno/widget npm package
    cli/                    # hissuno npm package (CLI)
```

---

## API Overview

```
/api/agent/                    # Main chat endpoint
/api/agent/stream/             # SSE streaming
/api/agent/session/close/      # Close session, trigger review

/api/integrations/widget/      # Widget settings

/api/projects/                 # Project CRUD
/api/projects/[id]/knowledge/  # Knowledge analysis

/api/sessions/                 # Session management
/api/sessions/[id]/review/     # PM review trigger

/api/issues/                   # Issue management
/api/issues/[id]/generate-brief/ # Brief generation

/api/mcp                       # MCP server endpoint

/api/integrations/github/      # GitHub OAuth
/api/integrations/slack/       # Slack integration
/api/integrations/intercom/    # Intercom sync
/api/integrations/gong/        # Gong sync
/api/integrations/fathom/      # Fathom sync
/api/integrations/zendesk/     # Zendesk sync
/api/integrations/jira/        # Jira sync
/api/integrations/linear/      # Linear sync
/api/integrations/hubspot/     # HubSpot sync
/api/integrations/notion/      # Notion connection
/api/integrations/posthog/     # PostHog sync
```

---

## Development

```bash
# Run Next.js dev server
npm run dev

# Run Mastra dev server (for agent playground)
npm run dev:mastra

# Run tests
npm run test

# Run PM agent evaluations
npm run eval:pm-agent

# Database migrations
npx drizzle-kit generate     # Generate migration from schema changes
npx drizzle-kit push         # Push schema directly (dev)
npx drizzle-kit migrate      # Run pending migrations (production)
```

---

## Troubleshooting

**`ERROR: could not open extension control file "vector"`**
pgvector is not installed. See the [PostgreSQL + pgvector Setup](#postgresql--pgvector-setup) section above.

**`ECONNREFUSED 127.0.0.1:5432`**
PostgreSQL is not running. Start it with `brew services start postgresql@15` (macOS) or `sudo systemctl start postgresql` (Linux).

**`OPENAI_API_KEY is not set`**
Make sure `.env.local` exists in the `app/` directory and contains your OpenAI key.

**Port 3000 already in use**
Another process is using port 3000. Either stop it or run Hissuno on a different port: `PORT=3001 npm run dev`

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, PR process, and code standards.

---

## License

MIT - See [LICENSE](LICENSE) for details.
