---
title: "Automatic Issue Creation"
description: "How Hissuno automatically creates issues from customer feedback using AI-powered analysis."
---

## Overview

Hissuno automatically converts customer feedback into structured, actionable issues. When a feedback session closes, the Session Review workflow analyzes the conversation and decides whether to create a new issue, upvote an existing one, or skip the session entirely. This process runs without any manual intervention, so your team always has an up-to-date backlog driven by real customer voices.

## How the Session Review Workflow Works

The Session Review workflow is a multi-step pipeline that runs automatically when a feedback session closes, or when you trigger it manually from the dashboard. It follows six sequential steps.

### Step 1: Classify the Session

The Tagging Agent reads the full conversation and applies classification labels. These labels determine how the rest of the pipeline interprets the feedback. Built-in tags include:

- **bug** -- The customer reported a technical issue or broken behavior.
- **feature_request** -- The customer asked for new functionality that does not exist yet.
- **change_request** -- The customer wants an improvement or UX change to an existing feature.
- **general_feedback** -- Broad commentary without a specific actionable item.
- **wins** -- Positive feedback or a success story.
- **losses** -- Negative experience or frustration signal.

A single session can receive multiple tags. For example, a conversation might be tagged both `bug` and `losses` if the customer reported a defect that caused significant frustration.

### Step 2: Prepare Context

The workflow gathers all the information the PM Agent needs to make a decision. This includes the full message history, session metadata (source, page URL, timestamps), project settings, and any existing knowledge about the product.

### Step 3: Resolve Contact

Before the PM Agent evaluates the feedback, Hissuno attempts to match the session to a known contact in your CRM. It extracts the email address from the session's user metadata and looks for a matching contact record. If no match exists and a valid email is present, Hissuno auto-creates the contact and resolves their company from the email domain. This ensures that every issue created downstream carries customer context.

### Step 4: Find Duplicates

The workflow searches for semantically similar existing issues using vector embeddings. It generates an embedding from the user's messages and compares it against all existing issue embeddings in the project. Results above a 0.5 similarity threshold are passed to the PM Agent as candidates for deduplication.

### Step 5: PM Agent Decision

The Product Manager Agent receives all of the prepared context -- tags, messages, similar issues, and customer data -- and makes one of three decisions:

- **Create** -- The feedback is actionable and no similar issue exists. The agent drafts a title, description, type, and suggested priority.
- **Upvote** -- A similar issue with a similarity score of 0.7 or higher already covers this feedback. The agent selects the best match for upvoting.
- **Skip** -- The session contains no actionable feedback (for example, a resolved Q&A or generic praise).

### Step 6: Execute the Decision

A deterministic step carries out whatever the PM Agent decided. For new issues, it inserts the record, generates a vector embedding, links the session, and fires off the Issue Analysis workflow. For upvotes, it increments the vote count and links the session to the existing issue. In all cases, the session is marked as reviewed.

## Issue Types

Every issue created by the PM Agent is assigned one of three types.

### Bug

A bug represents a defect or broken behavior in your product. The PM Agent assigns this type when the session tags include `bug` and the customer describes something that does not work as expected. Bug descriptions include expected versus actual behavior and any relevant context such as browser, page, or steps to reproduce.

### Feature Request

A feature request captures demand for entirely new functionality. The PM Agent uses this type when the session is tagged `feature_request` and the customer describes a use case that your product does not currently address. Descriptions focus on the underlying need and the workflow the customer is trying to accomplish.

### Change Request

A change request covers improvements to existing features -- UX refinements, workflow adjustments, or behavioral changes. The PM Agent assigns this type when the session is tagged `change_request`. These issues often describe friction in a current workflow rather than a missing capability.

## Priority Assignment

When creating a new issue, the PM Agent assigns an initial priority based on signals from the conversation:

| Priority | Signals |
|----------|---------|
| **High** | Customer is blocked, security or data concerns, `losses` tag present |
| **Medium** | Workflow disruption, clear frustration, core functionality affected |
| **Low** | Nice-to-have improvement, minor inconvenience, edge case |

This initial priority is later refined by the Issue Analysis workflow, which incorporates velocity, customer impact, and implementation effort into a composite score.

## Running a Review Manually

You can trigger the Session Review workflow for any closed session from the feedback detail view. Click the **Run PM Review** button in the session sidebar. The review streams progress events in real time so you can watch each step as it completes.

## Enabling and Disabling Auto-Creation

Issue tracking is controlled at the project level. Open the project edit dialog accessible from the **Dashboard** page and toggle **Issue Tracking**. When disabled, the Session Review workflow still classifies and tags sessions but skips the PM decision and execution steps. You can re-enable it at any time and manually review sessions that were closed while tracking was off.

## Working with Issues from the CLI

You can list, search, and create issues from the terminal:

```bash
# List open bugs sorted by priority
hissuno list issues --issue-type bug --status open --priority high

# Search for issues by topic
hissuno search "csv export" --type issues

# View full issue details with linked sessions
hissuno get issues iss_abc123

# Create an issue manually
hissuno add issues
# Prompts: type (bug/feature_request/change_request), title, description, priority

# Export high-priority issues to JSON
hissuno --json list issues --priority high > urgent-issues.json
```

## What Happens After an Issue Is Created

Immediately after creation, Hissuno kicks off the Issue Analysis workflow in the background. This workflow computes velocity, impact, and effort scores, then recalculates the issue's priority using a multi-factor algorithm. If your project has a Jira integration enabled, the new issue is also synced to Jira automatically.
