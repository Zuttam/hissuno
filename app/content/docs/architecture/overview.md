---
title: "Architecture Overview"
description: "Hissuno's 3-layer architecture - Base Graph, Automation, and Execution."
---

## Architecture Overview

Hissuno is built on a 3-layer architecture. The **Base Graph** captures and connects all product data. The **Automation** automates processing and enrichment. The **Execution** layer delivers value through agents and interfaces.

## Layer 1: Base Graph

The Base Graph is an interconnected knowledge graph containing five resource types:

- **[Feedback](/docs/architecture/knowledge-graph#feedback)** - Customer conversations from the widget, Slack, Intercom, Gong, and other channels
- **[Issues](/docs/architecture/knowledge-graph#issues)** - Bugs, feature requests, and change requests extracted from feedback
- **[Contacts & Companies](/docs/architecture/knowledge-graph#contacts--companies)** - The people and organizations behind the feedback
- **[Knowledge Sources](/docs/architecture/knowledge-graph#knowledge-sources)** - Your codebase, documentation, and reference materials
- **[Product Scopes](/docs/architecture/knowledge-graph#product-scopes)** - Your product ontology of areas and initiatives

These resources are connected through relationships and [embeddings](/docs/architecture/embeddings). Whenever an entity enters the graph, [graph evaluation](/docs/architecture/graph-evaluation) automatically discovers connections - linking new feedback to the right scope, related issues, relevant knowledge, and the customer who sent it.

## Layer 2: Automation

The Automation layer is a set of workflows that run without manual intervention:

- **[Resource Ingestion](/docs/architecture/resource-ingestion)** - When feedback closes, the review workflow classifies it with tags, resolves the customer contact, runs graph evaluation, and decides whether to create or upvote an issue.
- **[Issue Triage](/docs/architecture/issue-triage)** - When an issue is created or upvoted, the analysis workflow gathers linked feedback and customer context, scores technical impact and effort, and generates a product spec when thresholds are met.

## Layer 3: Execution

Agents and interfaces consume the graph to deliver value:

- **[Support Agent](/docs/architecture/support-agent)** - A customer-facing AI that answers questions using compiled knowledge packages, past conversations, and product context. Deployed via the embeddable widget or Slack.
- **[PM Copilot](/docs/architecture/pm-copilot)** - A team-facing AI assistant for PMs, founders, and engineers. Available in-app, via Slack, or through MCP.
- **[Interfaces](/docs/architecture/interfaces)** - MCP (Claude Desktop, Cursor), CLI, Skills, API, and the embeddable Widget.
