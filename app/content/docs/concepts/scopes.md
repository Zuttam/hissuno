---
title: "Scopes"
description: "Product areas and initiatives that organize the knowledge graph and give agents structured product understanding."
---

## Product Ontology: Scopes

Scopes are the organizational backbone of the graph. They define *what* your product is and give agents a structured understanding beyond raw data.

### Scope Types

- **Areas** - Permanent product domains (e.g., "Auth System", "Analytics Dashboard", "Billing"). These represent the stable parts of your product that persist across planning cycles.
- **Initiatives** - Time-bound efforts (e.g., "Q1 Onboarding Revamp", "Performance Sprint"). These capture what your team is actively working on.

### Goals

Each scope can have one or more goals - specific objectives that entities can be classified against. For example, an "Auth System" scope might have goals like "Reduce login friction" and "Add SSO support."

When [graph evaluation](/docs/concepts/graph-evaluation) links an entity to a scope, it also classifies which goal the entity serves. This means agents don't just see "a bug report about Auth" - they see "a bug report about the Auth System, impacting the Reduce Login Friction goal."

### How Scopes Connect

Every entity in the graph - sessions, issues, knowledge sources - gets automatically linked to relevant scopes via [graph evaluation](/docs/concepts/graph-evaluation). You define the scopes and goals; the system handles classification.

Scopes are configured per project in **Settings > Product Scopes**. You can define up to 20 scopes, each with a name, description, color, and optional goals.

### Managing Scopes from the CLI

```bash
# List all scopes in your project
hissuno list scopes

# Create a new scope interactively
hissuno add scopes
# Prompts: name, type (product_area/initiative), description, goals...

# Update an existing scope
hissuno update scopes scope_abc123

# View scope details and linked entities
hissuno get scopes scope_abc123
```
