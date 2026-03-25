---
title: "Knowledge Graph"
description: "How Hissuno's interconnected knowledge graph connects sessions, contacts, issues, scopes, and knowledge sources."
---

## The Knowledge Graph

At the core of Hissuno is an interconnected knowledge graph. Every entity - sessions, contacts, issues, scopes, knowledge sources, and companies - is a node in this graph, connected through a unified relationship layer.

```
     Knowledge <-> Scopes <-> Issues
          ^                     ^
          |                     |
     Sessions <-> Contacts -----+
```

Agents don't just retrieve isolated facts. They traverse relationships to build real understanding. A support agent answering a customer question can walk from the contact to their past sessions, to related issues, to the relevant codebase - assembling full context in one query. A coding agent can go from an issue to the customers who reported it, to their actual conversations, to understand the real problem before writing a line of code.

### Entity Types

| Entity | Description |
|--------|-------------|
| **Sessions** | Customer conversations from the widget, Slack, Intercom, Gong, and other feedback sources |
| **Contacts** | Individual people who interact with your product |
| **Companies** | Organizations that contacts belong to |
| **Issues** | Bugs, feature requests, and other product items extracted from sessions |
| **Knowledge Sources** | Your codebase, docs, websites, and other reference materials |
| **Scopes** | Product areas and initiatives that organize the graph (see [Scopes](/docs/concepts/scopes)) |

### Relationships

All connections between entities are stored in a single `entity_relationships` table. Each row links exactly two entities with optional metadata. Relationships are bidirectional - querying either direction returns the connection.

This uniform structure means every entity type can connect to every other entity type. A session links to the contact who created it, the issues extracted from it, the scopes it relates to, and the knowledge sources that informed the agent's response.
