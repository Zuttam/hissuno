---
title: "Graph Evaluation"
description: "The AI pipeline that automatically discovers relationships between entities in the knowledge graph."
---

## Graph Evaluation

Graph evaluation is the AI pipeline that automatically discovers relationships between entities. It runs whenever a new entity enters the system - a session is reviewed, an issue is created, a knowledge source is analyzed, or a contact is added.

### The Pipeline

The pipeline has three steps:

**1. Extract Topics**

An LLM extracts 3-5 key topics from the entity's content. For a customer session about login issues, the topics might be "SSO authentication," "password reset flow," and "session timeout." For contacts, the system skips LLM extraction and uses the embedding text directly.

**2. Discover Relationships**

Six strategies run in parallel, each looking for connections in a different direction:

| Strategy | Method | Matches Against |
|----------|--------|----------------|
| Scope text match | Keyword matching | Scope names, descriptions, and goals |
| Session search | Semantic vector search | Existing session [embeddings](/docs/concepts/embeddings) |
| Issue search | Semantic vector search | Existing issue [embeddings](/docs/concepts/embeddings) |
| Knowledge search | Semantic vector search | Knowledge chunk [embeddings](/docs/concepts/embeddings) |
| Contact search | Semantic vector search | Contact [embeddings](/docs/concepts/embeddings) |
| Company text match | Keyword matching | Company names and domains |

Each strategy that finds a match above the similarity threshold creates a relationship in the graph.

**3. Classify Goals**

When a [scope](/docs/concepts/scopes) match is found and that scope has goals, an LLM classifies which specific goal the entity serves. The reasoning is stored as relationship metadata, providing an audit trail for why the connection was made.

### When It Runs

Graph evaluation is triggered in two modes:

- **Inline** (synchronous) - During the session review and issue analysis workflows. The pipeline runs as a step in the workflow, and downstream steps use the results (e.g., the assigned scope).
- **Async** (fire-and-forget) - After knowledge source analysis or contact/company creation. The evaluation runs in the background without blocking other processing.

### The Result

A customer conversation about login failures automatically gets linked to the Auth scope, similar bug reports from other customers, the relevant codebase sections, and the customer's company. No manual triage required.
