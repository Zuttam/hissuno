---
title: "Resource Ingestion"
description: "The common pattern every resource follows when entering Hissuno - ingest, classify, embed, evaluate, and link."
---

## The Common Pattern

Every resource that enters Hissuno follows the same lifecycle: **Ingest -> Classify/Summarize -> Embed -> Graph Evaluate -> Link**. The specifics vary by resource type, but this pattern applies universally to feedback, knowledge sources, contacts, and companies.

[Embeddings](/docs/architecture/embeddings) make each resource searchable by meaning. [Graph evaluation](/docs/architecture/graph-evaluation) discovers connections to other resources in the [knowledge graph](/docs/architecture/knowledge-graph). The result is that every new piece of data is automatically woven into the broader product intelligence picture.

## Feedback Ingestion

When feedback closes (called a *session* in the code and API), it enters a multi-step review pipeline. The pipeline runs automatically and can also be triggered manually from the dashboard.

### Classify

The **Tagging Agent** analyzes the conversation and applies classification tags. Feedback can receive multiple tags from the built-in set: `bug`, `feature_request`, `change_request`, `general_feedback`, `wins`, and `losses`. For example, a conversation where a customer reports a defect that caused significant frustration would be tagged both `bug` and `losses`.

### Prepare Context

The workflow gathers everything the PM Agent needs to make its decision: the full message history, metadata (source, page URL, timestamps), project settings, and the tags applied in the classification step. Feedback with fewer than three messages is skipped as it typically lacks sufficient context.

### Resolve Contact

The workflow matches the feedback to a customer contact by looking up the email address from the user metadata. If a contact exists, the feedback is linked to it. If no contact exists but an email is available, a new contact is auto-created and the company is resolved from the email domain.

### Find Duplicates

The feedback content is converted to a [vector embedding](/docs/architecture/embeddings) and compared against all existing issue embeddings in the project using cosine similarity. Issues with a similarity score above 0.5 are returned as candidates for deduplication.

### PM Decision

The **Product Manager Agent** receives the enriched context and makes one of three decisions:

- **Create** - The feedback is actionable and no similar issue exists. The agent drafts a title, description, type, and suggested priority.
- **Upvote** - A similar issue with a similarity score of 0.7 or higher already covers this feedback. The agent selects the best match.
- **Skip** - The feedback contains nothing actionable (resolved Q&A, generic praise, off-topic conversation).

### Execute

A deterministic step carries out whatever the PM Agent decided. For new issues, it inserts the record, generates a vector embedding, links the feedback, and fires off the [Issue Triage](/docs/architecture/issue-triage) workflow. For upvotes, it increments the vote count and links the feedback. In all cases, the feedback is marked as reviewed.

## Knowledge Source Ingestion

When a knowledge source is analyzed, it goes through a dedicated pipeline that fetches, analyzes, sanitizes, and indexes the content.

### Fetch Content

Content is acquired based on the source type. Codebase sources clone or pull the GitHub repository to an ephemeral local directory. Documentation portals are crawled (up to 50 pages with rate limiting). Websites are fetched via HTTP and converted from HTML to text. Uploaded documents are read from secure storage.

### Analyze

Specialized agents process the fetched content. The **Codebase Analyzer** explores the repository structure, reads key configuration files, and searches for important patterns like API routes, components, and data models. The **Web Scraper** agent processes website and documentation portal content. The output is a comprehensive analysis covering product overview, features, architecture, and technical details.

### Sanitize

The **Security Scanner** agent scans analyzed content for sensitive information - API keys, tokens, database connection strings, private keys, and internal infrastructure details. Sensitive values are replaced with descriptive placeholders (e.g., `[REDACTED_API_KEY]`).

### Save and Embed

Sanitized content is compiled into categorized knowledge packages (business, product, technical, FAQ, how-to) and saved to storage. Each package is split into chunks and converted to [vector embeddings](/docs/architecture/embeddings) for semantic search, enabling the [Support Agent](/docs/architecture/support-agent) to find the most relevant knowledge when answering customer questions.

### Graph Evaluate

[Graph evaluation](/docs/architecture/graph-evaluation) runs to discover relationships between the new knowledge and existing resources in the graph.

## Contact and Company Ingestion

When contacts and companies are created or imported, they follow a streamlined version of the common pattern.

### Resolve Relationships

Email domain is used to map a contact to their company. If the company does not exist, it can be auto-created from the domain. This ensures that every contact carries organizational context.

### Generate Embedding

An [embedding](/docs/architecture/embeddings) is generated from the available data (name, email, company, notes) so the contact or company is searchable by meaning across the system.

### Graph Evaluate

[Graph evaluation](/docs/architecture/graph-evaluation) discovers related feedback, issues, and other resources. This surfaces the full history of a customer's interactions and the issues they have contributed to.

## Issue Types

Every issue created by the PM Agent is assigned one of three types.

### Bug

A defect or broken behavior in your product. Assigned when the customer describes something that does not work as expected. Bug descriptions include expected versus actual behavior and any relevant context such as browser, page, or steps to reproduce.

### Feature Request

Demand for entirely new functionality. Assigned when the customer describes a use case that your product does not currently address. Descriptions focus on the underlying need and the workflow the customer is trying to accomplish.

### Change Request

An improvement to an existing feature - UX refinements, workflow adjustments, or behavioral changes. These issues describe friction in a current workflow rather than a missing capability.

## Initial Priority

When creating a new issue, the PM Agent assigns an initial priority based on signals from the conversation. This priority is later refined by the [Issue Triage](/docs/architecture/issue-triage) workflow using a composite scoring algorithm.

| Priority | Signals |
|----------|---------|
| **High** | Customer is blocked, security or data concerns, `losses` tag present |
| **Medium** | Workflow disruption, clear frustration, core functionality affected |
| **Low** | Nice-to-have improvement, minor inconvenience, edge case |
