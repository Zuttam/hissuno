---
title: "Overview"
description: "An introduction to the Hissuno Agent system — how AI agents power customer support and product management."
---

## The Hissuno Agent System

Hissuno includes two AI agents that work together to create a continuous feedback loop between your customers and your product team. The **Support Agent** handles customer conversations in real time, while the **PM Copilot** automatically reviews every session to extract product insights, create issues, and generate specifications.

Together, they turn raw customer conversations into a prioritized, deduplicated product backlog - without manual triage.

## The Feedback Loop

The two agents form a closed loop that runs automatically for every conversation:

```
Customer Conversation
        |
  Support Agent -- answers using knowledge graph
        |
  Session Closes
        |
  PM Copilot -- reviews, extracts insights
        |
   +----+----+
   |         |
 New Issue   Upvote Existing
   |              |
 Analysis    Re-prioritize
   |
 Spec Generated (when threshold met)
```

This pipeline runs for every conversation - whether it comes through the widget, Slack, Intercom, or Gong. No manual triage is needed.

## Support Agent

The Support Agent is Hissuno's customer-facing AI. It powers real-time conversations with your customers, answering questions and collecting feedback using your product knowledge.

### Data Sources

- **Codebase knowledge** - Extracted from your connected GitHub repository by the Codebase Analyzer, covering features, API behavior, configuration options, and product capabilities
- **Documentation** - Content from your knowledge sources including help docs, guides, and FAQs
- **Custom knowledge** - Manually added knowledge entries that address specific topics or edge cases
- **Customer context** - Profile information, company details, and past interaction history

### What It Produces

- **Responses** - Accurate, contextual answers grounded in your product knowledge
- **Escalations** - Handoffs to human agents when the query exceeds the agent's capabilities
- **Session transcripts** - Full conversation records that feed into the PM Copilot's analysis pipeline

### Where It Runs

- **Widget** - Embedded in your product via the Hissuno widget (the primary deployment channel)
- **Slack** - Responds to customer conversations in connected Slack channels
- **Intercom** - Handles conversations through your Intercom integration

[Learn more about the Support Agent](/docs/agents/support-agent)

## PM Copilot

The PM Copilot is Hissuno's automated product manager. After every customer session closes, it reviews the conversation, classifies the feedback, and either creates a new issue or upvotes an existing one. When an issue accumulates enough reports, you can generate a product specification.

### Data Sources

- **Session transcripts** - The full conversation from the Support Agent, including customer messages and agent responses
- **Existing issues** - The current issue backlog, used for deduplication and upvote matching
- **Customer and company data** - Profile information and segment data used to weight issue priority
- **Codebase knowledge** - Product context used when generating specifications

### What It Produces

- **Session classifications** - Tags like `bug`, `feature_request`, `change_request`, `wins`, `losses`, and `general_feedback`
- **Issues** - New backlog items with title, description, category, priority, and customer links
- **Upvotes** - Incremented counts on existing issues, with linked sessions and affected customers
- **Specifications** - Detailed product specs including problem statement, customer evidence, suggested solution, and acceptance criteria

### Where It Runs

- **Automatic (background)** - Runs after every session closes, with no manual trigger required
- **Dashboard sidebar** - Results are visible in the session detail view and the issues list
- **Slack** - Notifications for new issues and priority changes can be sent to Slack channels
- **MCP** - Issue data and session analysis results are available through the MCP resource tools

[Learn more about the PM Copilot](/docs/agents/pm-copilot)

## Agent Comparison

| | Support Agent | PM Copilot |
|---|---|---|
| **Audience** | Customers | Your team |
| **Trigger** | Customer starts conversation | Session closes |
| **Inputs** | Knowledge packages, past conversations | Session transcript, existing issues |
| **Outputs** | Responses, escalations | Issues, upvotes, specs |
| **Deployment** | Widget, Slack, Intercom | Automatic (background) |

## Data Flow

The full pipeline from customer conversation to actionable product spec follows these stages:

### 1. Session Capture

Every customer interaction - regardless of channel - is recorded as a feedback session. The session includes the full conversation transcript, customer identity, timestamps, and metadata about the channel.

### 2. Classification

The PM Copilot tags each session with one or more categories from the standard set (`bug`, `feature_request`, `change_request`, `wins`, `losses`, `general_feedback`). These tags appear on the session detail page and are used for filtering in the dashboard.

### 3. Issue Creation and Deduplication

The PM Copilot extracts individual feedback items from each session. A single conversation may contain multiple distinct concerns. For each item, the agent checks for semantic similarity against existing issues. If a match is found, the existing issue is upvoted. If not, a new issue is created with a title, description, category, and initial priority.

### 4. Priority Scoring

As upvotes accumulate, issue priority is recalculated based on multiple signals: the number of affected customers, customer segment (enterprise customers carry more weight), recency of feedback, and sentiment intensity. This ensures the most impactful issues rise to the top of your backlog.

### 5. Spec Generation

When an issue has accumulated enough evidence and your team is ready to act on it, you can trigger spec generation from the issue detail page. The generated spec includes a problem statement grounded in real customer feedback, affected customer list, suggested solution informed by codebase knowledge, and concrete acceptance criteria.

## Configuring Agents

Both agents are configurable from the **Agents** page in the sidebar. Each agent has its own configuration card where you can customize behavior, guidelines, and thresholds. See the individual agent pages for detailed configuration options.
