# Hissuno

**Turn customer conversations into shipped code.**

Hissuno is a customer intelligence platform that powers any customer-facing interaction—support, sales, customer success—with accurate product and technical knowledge, while automatically converting meaningful feedback into actionable engineering work.

---

## The Problem

Customer-facing teams constantly face knowledge gaps:

- **Support** escalates technical questions to engineering, causing delays
- **Sales** says "let me get back to you" during demos when deep technical questions arise  
- **Customer Success** lacks confidence discussing product capabilities and integrations
- **Product & Engineering** get interrupted with context requests and lose valuable feedback in Slack threads

Meanwhile, customer pain dies in tickets and conversations. Issues take days to become actionable. Context gets lost between teams. Small teams lose hours to support interruptions while real problems never get addressed.

---

## The Solution

Hissuno provides two connected value streams:

### 1. Empower Customer-Facing Teams

An AI agent that understands your codebase, documentation, and product—powering faster, more accurate customer conversations:

| Use Case | How Hissuno Helps |
|----------|-------------------|
| **Support** | Answer technical questions instantly without escalating to engineering |
| **Customer Success** | Discuss product capabilities, roadmap, and integrations accurately during QBRs |
| **Sales** | Handle deep technical questions during demos with confidence |
| **Pre-sales** | Ground technical scoping in actual implementation reality |

### 2. Remove Friction from Product & Engineering

When conversations contain actionable feedback, Hissuno automatically:

- **Creates issues** from bugs, feature requests, and change requests
- **Deduplicates** by finding and upvoting similar existing issues
- **Prioritizes** based on frequency (upvote count from multiple sessions)
- **Generates product specs** when issues reach significance thresholds

Engineers receive pre-triaged feedback with context, user quotes, and requirements—not vague tickets.

---

## How It Works

```
┌──────────────────────────────────────────────────────────────────────┐
│              ANY CUSTOMER INTERACTION                                 │
│     Support │ Success │ Sales │ Onboarding │ Technical Consults      │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │
                                   ▼
              ┌────────────────────────────────────────┐
              │         Hissuno Knowledge Layer        │
              │  • Codebase analysis                   │
              │  • Product documentation               │
              │  • Technical specifications            │
              └────────────────────┬───────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
         ┌──────────────────┐          ┌──────────────────────┐
         │ Immediate Value  │          │ Downstream Value     │
         │ • Fast answers   │          │ • Aggregated issues  │
         │ • Accuracy       │          │ • Product specs      │
         │ • Confidence     │          │ • Prioritized backlog│
         └──────────────────┘          └──────────────────────┘
```

### Knowledge Analysis

When you set up a project, Hissuno analyzes your knowledge sources:

- **Source code** — GitHub repository or uploaded codebase
- **Websites** — Marketing site, documentation, landing pages
- **Documents** — PDFs, markdown files, wikis

This is compiled into three searchable knowledge packages:
- `business` — Company info, pricing, policies
- `product` — Features, use cases, how-to guides
- `technical` — API reference, architecture, integrations

### Session Review

When a customer conversation closes, an AI Product Manager reviews it:

1. **Classifies** the session (bug, feature request, general feedback, etc.)
2. **Determines** if it's actionable or just a resolved Q&A
3. **Searches** for similar existing issues to avoid duplicates
4. **Creates or upvotes** issues with proper context and priority
5. **Generates specs** when issues reach configurable thresholds

---

## Architecture

### Tech Stack

- **Framework**: Next.js 16 (App Router, React 19)
- **Database**: Supabase (PostgreSQL)
- **AI Framework**: [Mastra](https://mastra.ai) — multi-agent orchestration
- **LLM**: OpenAI (GPT-4o, GPT-5)
- **Storage**: Supabase Storage
- **Integrations**: GitHub, Slack

### AI Agents

| Agent | Purpose |
|-------|---------|
| **Support Agent** | Powers customer conversations using knowledge tools |
| **Codebase Analyzer** | Extracts high-level product knowledge from source code |
| **Web Scraper** | Analyzes website content for product knowledge |
| **Knowledge Compiler** | Categorizes findings into business/product/technical |
| **Security Scanner** | Redacts sensitive information from knowledge |
| **Tagging Agent** | Classifies sessions with appropriate labels |
| **Product Manager** | Analyzes sessions, creates/upvotes issues |
| **Spec Writer** | Generates comprehensive product specifications |

### Workflows

**Knowledge Analysis Workflow**
```
Analyze Codebase → Analyze Sources → Compile Knowledge → Sanitize → Save Packages
```

**Session Review Workflow**
```
Classify Session → PM Review → Create/Upvote Issue → (Generate Spec if threshold met)
```

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

- **Projects** — Create and configure projects, connect knowledge sources
- **Sessions** — View all customer conversations with filtering and search
- **Issues** — Track bugs and feature requests identified from sessions
- **Settings** — Widget configuration, issue thresholds, integrations

### Integrations

- **GitHub** — Connect repositories for codebase analysis
- **Slack** — Monitor channels, create sessions from messages

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL (via Supabase)
- OpenAI API key

### Environment Variables

```bash
cp env.example .env.local
```

Required variables:
```
DATABASE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
```

### Installation

```bash
npm install
npm run dev
```

### Database Setup

```bash
cd supabase
supabase db push
```

---

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Login, signup pages
│   ├── (authenticated)/   # Dashboard pages
│   └── api/               # API routes
├── components/            # React components
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities and services
├── mastra/                # AI agents and workflows
│   ├── agents/           # Agent definitions
│   ├── tools/            # Agent tools
│   └── workflows/        # Workflow definitions
└── types/                # TypeScript types

packages/
└── widget/               # @hissuno/widget package
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
/api/issues/[id]/generate-spec/ # Spec generation

/api/integrations/github/      # GitHub OAuth
/api/integrations/slack/       # Slack integration
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
```

---

## License

Private — All rights reserved.
