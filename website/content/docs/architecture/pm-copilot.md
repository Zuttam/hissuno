---
title: "PM Copilot"
description: "How the PM Copilot automatically analyzes customer feedback, creates issues, and generates product specs."
---

## Overview

The PM Agent is Hissuno's automated product manager. It reviews every piece of customer feedback, identifies actionable product insights, and maintains a living backlog of customer-reported issues. When enough customers report the same problem, the PM Agent generates a product specification to help your team move from feedback to implementation.

## How the PM Agent Analyzes Feedback

The PM Copilot's analysis runs as part of the [resource ingestion](/docs/architecture/resource-ingestion) pipeline. When feedback closes, the pipeline classifies it, resolves contacts, checks for duplicates, and invokes the PM Copilot to decide whether to create a new issue, upvote an existing one, or skip.

### Feedback Classification

The PM Agent classifies each piece of feedback by assigning one or more tags from the standard set:

- `general_feedback` - General product observations
- `wins` - Positive feedback and praise
- `losses` - Churn signals or negative outcomes
- `bug` - Bug reports and defects
- `feature_request` - Requests for new capabilities
- `change_request` - Requests to modify existing behavior

Classification results appear on the feedback detail page and can be used for filtering in the dashboard.

### Feedback Extraction

Within each piece of feedback, the PM Agent identifies individual items. A single conversation may contain multiple distinct concerns. For example, a customer might report a bug and also request a new feature in the same conversation. The PM Agent separates these into discrete items for proper tracking.

Each extracted item includes:

- A concise summary of the customer's concern
- The relevant quote from the conversation
- The inferred category and urgency
- The customer and company context

## Issue Creation and Upvoting

### How Issues Are Created

When the PM Agent identifies a concern that does not match any existing issue, it creates a new one. New issues include:

- **Title** - A clear, descriptive summary of the problem or request
- **Description** - Synthesized from the customer's words with relevant context
- **Category** - Bug, feature request, or change request
- **Priority** - Based on urgency, customer impact, and frequency signals
- **Customer link** - The feedback and customer that first reported the issue
- **Initial upvote count** - Starts at 1

### How Upvoting Works

When extracted feedback matches an existing issue, the PM Agent upvotes it instead of creating a duplicate. The matching process considers:

1. **Semantic similarity** - Is the customer describing the same problem, even in different words?
2. **Scope** - Does the feedback relate to the same product area or initiative?
3. **Category alignment** - Is this the same type of concern (bug vs. feature request)?

When an issue is upvoted:

- The upvote count increments
- The new feedback is linked to the issue
- The customer is added to the issue's affected customers list
- The issue description may be refined to incorporate new context

### Issue Priority Recalculation

As upvotes accumulate, the PM Agent periodically recalculates issue priority. Factors include:

- **Customer count** - More affected customers increases priority
- **Customer segment** - Issues affecting enterprise or high-value customers are weighted higher
- **Recency** - Recent feedback is weighted more than old feedback
- **Sentiment intensity** - Frustrated or angry feedback raises priority

## Spec Generation

### What Triggers Spec Generation

Spec generation is triggered manually from the issue detail page. When you want a specification for an issue, click the **Generate Spec** button on the issue. This gives your team control over which issues receive detailed specifications.

### What the Spec Contains

Generated specifications include:

- **Problem statement** - What customers are experiencing, grounded in real feedback
- **Customer evidence** - Quotes and data from the feedback that reported this issue
- **Affected customers** - List of customers and companies impacted
- **Suggested solution** - A proposed approach based on the product context and codebase knowledge
- **Acceptance criteria** - Concrete conditions for the issue to be considered resolved
- **Related issues** - Links to similar or dependent issues

### Spec Review

Specs are generated as drafts and appear in the issue detail page under the **Specification** tab. Your team should review and refine the spec before moving it to engineering. The PM Agent provides a starting point, not a final product decision.

## Configuring the PM Agent

You can customize the PM Agent by navigating to the **Agents** page, then clicking **Configure** on the Product Specialist card. The configuration dialog provides the following settings:

### Classification Guidelines

Provide guidelines that help the PM Agent classify feedback more accurately. If the agent consistently miscategorizes certain types of feedback, add instructions here. For example:

```
Any mention of "slow" or "loading" in the context of page rendering
should be categorized as a bug, not a feature_request.
```

### Analysis Guidelines

Control how the PM Agent analyzes feedback and extracts actionable items. These guidelines influence how the agent identifies distinct concerns, determines severity, and decides whether feedback warrants a new issue.

### Spec Guidelines

When a spec is generated for an issue, these guidelines shape the output. You can specify your preferred format, level of detail, and what sections to include.

### Deduplication

The PM Agent uses fixed similarity thresholds when matching feedback against existing issues. Feedback that is semantically similar to an existing issue is upvoted; otherwise, a new issue is created. Feedback with fewer than 3 messages is automatically excluded from analysis.

### Manual Corrections

You can always manually override the PM Agent's decisions:

- Re-categorize feedback from the detail page
- Merge duplicate issues from the issues list
- Change issue priority manually (this prevents future automatic recalculation)
- Unlink feedback from an issue if it was incorrectly matched

Manual corrections help the PM Agent learn your team's preferences over time.
