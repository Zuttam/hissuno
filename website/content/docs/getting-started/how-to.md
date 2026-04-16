---
title: "How To"
description: "Practical workflows for common tasks in Hissuno."
---

## Review Feedback and Act on It

1. Open the **Feedback** page from the sidebar to see all sessions
2. Use filters to narrow by status, tags, source, or date range
3. Click a session to view the full conversation and extracted feedback
4. If the automated pipeline missed something, click **Create Issue** to manually create an issue from the session, or link it to an existing issue
5. Mark sessions as reviewed once you have processed them

The automated pipeline handles most of this for you. See [Resource Ingestion](/docs/architecture/resource-ingestion) for how sessions are processed automatically.

## Configure Your Product Scopes

1. Navigate to **Product Scopes** in the sidebar
2. Create **areas** for permanent product domains (e.g., "Authentication", "Billing", "API")
3. Create **initiatives** for time-bound efforts (e.g., "Q2 Mobile Launch", "Enterprise Tier")
4. Add **goals** to each scope to define measurable outcomes
5. The system automatically classifies incoming sessions and issues into the relevant scopes using [graph evaluation](/docs/architecture/graph-evaluation)

See [Knowledge Graph](/docs/architecture/knowledge-graph) for how scopes connect to other resources.

## Set Up Knowledge Sources and Run Analysis

1. Navigate to the **Agents** page from the sidebar
2. Open the knowledge sources dialog and add your sources - codebase (GitHub repo), website URLs, documentation portals, or uploaded documents
3. Click **Run Analysis** to trigger the multi-step pipeline
4. The pipeline analyzes each source, compiles categorized knowledge packages, sanitizes sensitive data, and indexes everything for semantic search
5. Review the compiled packages to verify accuracy and identify gaps

See [Support Agent](/docs/architecture/support-agent) for how packages power the agent's responses.

## Use the CLI for Day-to-Day Operations

Install and configure the CLI:

```bash
npm i -g hissuno
hissuno config
```

Common commands for listing, searching, and inspecting resources:

```bash
hissuno list feedback --source widget
hissuno search "login issues" --type issues
hissuno list issues --priority high
hissuno get issues iss_abc123
```

The CLI supports both interactive and non-interactive modes. See the [CLI documentation](/docs/connect/cli) for the full command reference.

## Connect External Agents

1. Install the Hissuno CLI: `npm install -g hissuno`
2. Configure it with your API key and project ID
3. Agents get access to search feedback, list issues, query knowledge, and ask Hissuno questions about your product

See the [CLI documentation](/docs/connect/cli) for setup instructions and available commands.
