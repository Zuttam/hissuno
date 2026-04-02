---
title: "Knowledge Graph"
description: "The interconnected graph of feedback, issues, contacts, companies, knowledge sources, and product scopes that forms Hissuno's Base Graph."
---

## The Knowledge Graph

At the core of Hissuno is an interconnected knowledge graph. Every resource - feedback, issues, contacts, companies, knowledge sources, and product scopes - is a node in this graph, connected through a unified relationship layer.

```
    Knowledge Sources <---> Product Scopes <---> Issues
            ^                     ^                 ^
            |                     |                 |
        Feedback <----------> Contacts/Companies ---+
```

Agents traverse these relationships to build real understanding. A support agent answering a customer question walks from the contact to their past feedback, to related issues, to the relevant codebase - assembling full context in one query.

---

## Feedback

Feedback is the core data unit in Hissuno. Each feedback entry (called a *session* in the code and API) represents a single customer interaction - a live chat conversation, a synced support ticket, a sales call transcript, or behavioral event data.

A feedback entry contains:

- **Messages** - The full conversation history between the customer and the agent (or human agent)
- **Metadata** - Customer identity, source channel, page URL, timestamps, and custom metadata from the integration
- **Tags** - Classification labels applied automatically by AI or manually by your team
- **Contact** - The matched customer contact record, resolved from email or metadata
- **Linked Issues** - Engineering issues created or upvoted as a result of reviewing this feedback

### Types

| Type | Description | Typical Source |
|------|-------------|---------------|
| Chat | Live chat conversation with back-and-forth messages | Widget, Slack, Intercom |
| Meeting | Call or meeting transcript | Gong, Fathom |
| Behavioral | User behavior events and actions | API |

The type is automatically set based on the source channel.

### Lifecycle

| Status | Description |
|--------|-------------|
| **Active** | The conversation is live. The agent responds to customer messages in real time. A team member can trigger a human takeover to respond directly. |
| **Closing Soon** | The agent detected a goodbye signal. An idle timer starts, and if no further messages arrive, the conversation closes automatically. |
| **Awaiting Idle** | The customer stopped responding mid-conversation. The system sends an idle prompt to check if they still need help. |
| **Closed** | The feedback enters the review pipeline. The [resource ingestion](/docs/architecture/resource-ingestion) workflow classifies the conversation and decides whether to create or upvote an issue. |

### Tags and Classification

Feedback is classified with tags that indicate its nature. Tags are applied automatically by the Tagging Agent during review, and can also be applied manually.

**Built-in tags:**

| Tag | Applied When |
|-----|-------------|
| General Feedback | General product feedback, suggestions, or opinions |
| Win | Customer expresses satisfaction, success, or positive experience |
| Loss | Customer expresses frustration, failure, or negative experience |
| Bug | Customer reports something not working as expected |
| Feature Request | Customer asks for new functionality |
| Change Request | Customer requests modification to existing functionality |

Feedback can have multiple tags. Projects can also define **custom tags** with their own names, descriptions, and colors. Custom tags are created on the Agents page under PM Agent settings and become available for both automatic and manual classification.

### Source Channels

Feedback is captured from multiple channels and consolidated into a single list:

- **[Widget](/docs/integrations/widget)** - Embeddable chat component for your website or app. Customers interact with the agent directly.
- **[Slack](/docs/integrations/slack)** - Monitors configured channels in interactive or passive mode. Each thread becomes a feedback entry.
- **[Intercom](/docs/integrations/intercom)** - Syncs conversations on a configurable schedule (manual, hourly, daily).
- **[Gong](/docs/integrations/gong)** - Imports call recordings and transcripts as meeting-type feedback.
- **[Fathom](/docs/integrations/fathom)** - Imports AI meeting notes and transcripts as meeting-type feedback.
- **[Zendesk](/docs/integrations/zendesk)** - Syncs solved and closed support tickets.
- **API** - Create feedback programmatically for channels not covered by built-in integrations.
- **Manual** - Create feedback from the dashboard or CLI for conversations received offline.

---

## Issues

Issues represent actionable product items extracted from customer feedback - bugs, feature requests, and change requests. They are the bridge between what customers are saying and what your team needs to build or fix.

Issues can be created automatically by the [resource ingestion](/docs/architecture/resource-ingestion) workflow when feedback closes, or manually from the dashboard and CLI.

### Issue Statuses

| Status | Description |
|--------|-------------|
| Open | The issue is active and unresolved |
| In Progress | Someone is working on the issue |
| Resolved | The issue has been addressed |
| Closed | The issue is complete or no longer relevant |

### Enrichment

When an issue is created or upvoted, the [issue triage](/docs/architecture/issue-triage) workflow gathers all linked feedback and customer context, analyzes technical impact and effort, computes a priority score, and generates a product spec when configurable thresholds are met. See the [issue triage](/docs/architecture/issue-triage) page for full details on scoring and spec generation.

---

## Contacts & Companies

Contacts are the individual people who provide feedback, report issues, or interact with the agent. Companies are the organizations those contacts belong to. Together they form the customer layer of the knowledge graph, and their data feeds directly into issue prioritization.

### Contact Fields

| Field | Description |
|-------|-------------|
| **Name** | The contact's full name |
| **Email** | Email address (unique within a project) |
| **Company** | The company this contact belongs to |
| **Role** | Functional role (e.g., "Engineering Manager") |
| **Title** | Job title |
| **Champion** | Boolean flag for product champions |
| **Last Contacted** | Timestamp of their most recent feedback (updated automatically) |

### Company Fields

| Field | Description |
|-------|-------------|
| **Name** | Display name |
| **Domain** | Email domain (e.g., `acme.com`), used for automatic contact matching |
| **ARR** | Annual recurring revenue - feeds directly into issue impact scoring |
| **Stage** | Lifecycle stage (see below) |
| **Industry** | Industry vertical |
| **Plan Tier** | Pricing plan |
| **Employee Count** | Organization size |
| **Renewal Date** | Contract renewal date |
| **Health Score** | 0-100 account health score |

### Automatic Resolution

When feedback closes, Hissuno automatically resolves the customer's identity:

1. Extracts the email address from the feedback metadata
2. Searches for an existing contact with that email
3. If found, links the feedback and updates `last_contacted_at`
4. If not found, creates a new contact automatically
5. Resolves the company by matching the email domain against existing company domains (generic providers like Gmail and Yahoo are excluded)

Your CRM grows organically as customers interact with your product - no need to pre-populate contacts.

### Lifecycle Stages

Every company is assigned a lifecycle stage that influences how their feedback is prioritized:

| Stage | Description | Prioritization Weight |
|-------|-------------|----------------------|
| **Prospect** | Evaluating the product, trial or POC | 0.8x |
| **Onboarding** | Committed, deploying the product | 1.0x (baseline) |
| **Active** | Using the product in production | 1.2x |
| **Expansion** | Growing usage - adding seats, upgrading plans | 1.3x (highest) |
| **Churned** | Stopped using the product or did not renew | 1.1x |

These weights feed into the issue impact scoring algorithm. An expansion-stage customer's bug report carries more weight than the same report from a prospect, because expansion accounts represent active growth.

### Custom Fields

You can extend company and contact records with custom fields to track data specific to your business. Five field types are supported:

| Type | Use Case |
|------|----------|
| **Text** | Free-form strings (internal ID, CSM name) |
| **Number** | Quantitative metrics (NPS score, seat count) |
| **Date** | Temporal data (onboarding date, last QBR) |
| **Boolean** | Binary flags (signed NDA, beta participant) |
| **Select** | Single-choice dropdown with predefined options (region, contract type) |

Custom fields are created from the **Custom Fields** tab on the Customers page and appear alongside standard fields in detail views. They can be populated during CSV imports and through the API.

### CSV Import

For teams with existing customer data, Hissuno supports bulk import via CSV. Navigate to Customers, click **Import CSV**, upload your file, map columns to Hissuno fields, and import. The process creates new records and updates existing ones (matched by email for contacts, domain for companies).

---

## Knowledge Sources

Knowledge sources are the raw inputs that Hissuno analyzes to build the Support Agent's understanding of your product. By connecting your codebase, documentation, and other materials, you give the agent the context it needs to answer customer questions accurately.

Each source is analyzed by AI agents that extract business, product, and technical information. The results are compiled into knowledge packages that the Support Agent references during conversations.

### Source Types

| Type | Description |
|------|-------------|
| **Codebase** | A GitHub repository. The Codebase Analyzer agent explores your project structure, API routes, data models, and architecture. Supports branch selection and subdirectory scoping for monorepos. |
| **Website** | A single URL fetched and analyzed for product information - marketing pages, landing pages, or individual articles. |
| **Documentation Portal** | A root URL crawled up to 50 pages deep. Best for docs sites built with Docusaurus, GitBook, ReadMe, or Nextra. |
| **Uploaded Document** | PDF, plain text, Markdown, or Word files uploaded directly. Maximum 10 MB per file. |
| **Raw Text** | Text pasted directly into the source editor - useful for support runbooks, internal policies, or product notes. |

### Adding a Knowledge Source

1. Navigate to the **Agents** page and open a knowledge package
2. Click **Add Source** and select the source type
3. Fill in the required fields (repository, URL, file, or text content)
4. The source is created with a **Pending** status

Sources move through statuses: Pending, Processing, Completed, or Failed. Each source has an enabled/disabled toggle - disabled sources are skipped during analysis but remain saved.

### How Sources Feed the Support Agent

When analysis runs, each enabled source is processed according to its type. All source analyses run sequentially, and the results are passed to a compilation step where they are combined into categorized knowledge packages. The [Support Agent](/docs/architecture/support-agent) retrieves the appropriate package based on conversation context to generate grounded responses.

---

## Product Scopes

Product scopes define the structure of your product inside Hissuno. They represent what your product is made of and what your team is working on. Every piece of feedback, issue, and knowledge source gets automatically classified into a scope through [graph evaluation](/docs/architecture/graph-evaluation) - so instead of sifting through unstructured data, you see signals organized by the product areas and initiatives they relate to.

### Scope Types

- **Areas** - Permanent product domains (e.g., "Auth System", "Analytics Dashboard", "Billing"). These represent the stable parts of your product that persist across planning cycles.
- **Initiatives** - Time-bound efforts (e.g., "Q1 Onboarding Revamp", "Performance Sprint"). These capture what your team is actively working on.

### Goals

Each scope can have up to 10 goals - specific, measurable objectives that describe what success looks like. When [graph evaluation](/docs/architecture/graph-evaluation) links an entity to a scope, it also classifies which goal the entity aligns with. This means you don't just see "a bug report about Auth" - you see "a bug report about the Auth System, impacting the Reduce Login Friction goal."

Goals should be written as outcomes, not tasks:

- "Reduce time-to-first-value below 5 minutes" (good)
- "Build new onboarding wizard" (less useful - describes a solution, not an outcome)

### How Classification Works

1. A semantic embedding is generated from the entity's content
2. The embedding is compared against scope embeddings (built from name, description, type, and goals)
3. The entity is assigned to the best-matching scope
4. The specific goal within that scope is identified

You can also manually reassign entities to different scopes from the dashboard.

### The Default Scope

Every project starts with a "General" scope. This catch-all receives entities that don't match any specific scope strongly enough. The default scope cannot be deleted or changed to an initiative type. As you define more specific scopes, fewer entities land in General.

### Limits

| Limit | Value |
|-------|-------|
| Scopes per project | 20 |
| Goals per scope | 10 |
| Name length | 50 characters |
| Description length | 500 characters |
| Goal text length | 500 characters |

### Managing Scopes

From the dashboard, navigate to **Product Scopes** in the sidebar. Click **Add Scope** to create one, or open an existing scope to edit its name, type, description, color, and goals inline.

From the CLI:

```bash
# List all scopes
hissuno list scopes

# Create a new scope interactively
hissuno add scopes

# View scope details and linked entities
hissuno get scopes scope_abc123

# Update an existing scope
hissuno update scopes scope_abc123
```

### Design Patterns

**By product domain** - Create areas that map to your product's major surfaces (Auth, Dashboard, API, Billing, Integrations). Works well for teams organized by domain ownership.

**By team** - Create areas that match your engineering teams (Growth, Platform, Enterprise). Works well for larger organizations where multiple teams need their own signal views.

**Combining both** - Use areas for permanent domains and initiatives for time-bound efforts. Entities get classified into areas by default, while initiative scopes track progress on specific efforts. When an initiative ends, delete it - the underlying entities remain classified in their areas.

---

## Relationships

All connections between entities are stored in a single `entity_relationships` table. Each row links exactly two entities with optional metadata. Relationships are bidirectional - querying either direction returns the connection.

This uniform structure means every entity type can connect to every other entity type. A feedback entry links to the contact who created it, the issues extracted from it, the scopes it relates to, and the knowledge sources that informed the agent's response. Relationships are created automatically by [graph evaluation](/docs/architecture/graph-evaluation) and by the [resource ingestion](/docs/architecture/resource-ingestion) workflow.
