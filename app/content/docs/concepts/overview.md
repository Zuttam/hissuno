---
title: "Core Concepts"
description: "The foundational systems that power Hissuno - knowledge graph, scopes, embeddings, and graph evaluation."
---

Hissuno is built on four foundational systems that work together to turn raw customer feedback into structured, actionable product intelligence. Each system handles a different part of the pipeline - from organizing data to discovering connections automatically.

## [Knowledge Graph](/docs/concepts/knowledge-graph)

Every entity in Hissuno - sessions, contacts, issues, scopes, knowledge sources, and companies - is a node in an interconnected knowledge graph. Agents traverse these relationships to build real understanding, assembling full context from multiple entity types in a single query.

## [Scopes](/docs/concepts/scopes)

Scopes define *what* your product is. They come in two types - areas (permanent product domains) and initiatives (time-bound efforts) - and each can have specific goals. Scopes give agents a structured product understanding beyond raw data.

## [Embeddings](/docs/concepts/embeddings)

Every session, issue, contact, and knowledge chunk gets a vector embedding that captures its semantic meaning. These embeddings power deduplication, semantic search, and relationship discovery across the entire graph.

## [Graph Evaluation](/docs/concepts/graph-evaluation)

An AI pipeline that automatically discovers relationships between entities whenever new data enters the system. It extracts topics, runs six parallel discovery strategies, and classifies entities against scope goals - connecting feedback to the right product areas without manual triage.

---

## Built-In Intelligence

Hissuno ships with agents and automation flows that deliver value on top of the knowledge graph.

### Support Agent

A customer-facing AI that answers questions using your knowledge graph. It retrieves relevant knowledge packages, past conversations, and product context to generate grounded responses. Deploy it via the [embeddable widget](/docs/integrations/widget) or [Slack](/docs/integrations/slack).

See [Support Agent](/docs/agents/support-agent) for configuration details.

### Product Co-Pilot

A team-facing AI assistant for PMs, founders, and engineers. Available in-app (sidebar), via Slack, or through MCP (Claude Desktop, Cursor). It has full access to project data and can query issues, search feedback, and explore the knowledge graph conversationally.

See [PM Copilot](/docs/agents/pm-copilot) for capabilities and usage.

### Automation Flows

**Feedback Triage** - When a customer session closes, the [review workflow](/docs/feedback/review-workflow) automatically classifies the conversation, links it to contacts and scopes via graph evaluation, searches for duplicate issues, and decides whether to create a new issue, upvote an existing one, or archive.

**Issue Analysis** - When an issue is created or upvoted, the analysis workflow gathers all linked sessions and customer context, analyzes technical impact and effort against the codebase, computes [priority scores](/docs/issues/priority), and generates a [product spec](/docs/issues/specs) when configurable thresholds are met.

Both flows run automatically. The graph evaluation pipeline connects each piece of feedback to the right scope, related entities, and existing issues - closing the loop from customer signal to product action.
