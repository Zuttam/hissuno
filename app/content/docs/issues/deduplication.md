---
title: "Issue Deduplication"
description: "How Hissuno detects duplicate issues using semantic search and consolidates feedback through upvoting."
---

## Overview

When multiple customers report the same problem, Hissuno needs to recognize that the feedback maps to a single underlying issue rather than creating a separate entry for each report. The deduplication system uses vector embeddings and semantic similarity search to find matches automatically. When a match is found, the existing issue is upvoted instead of creating a duplicate, and the new feedback session is linked for full traceability.

## How Semantic Duplicate Detection Works

Hissuno uses OpenAI's `text-embedding-3-small` model to generate 1536-dimensional vector embeddings for every issue. When a new feedback session is reviewed, the system generates an embedding from the customer's messages and compares it against all existing issue embeddings in the project using cosine similarity.

### The Search Process

1. The Session Review workflow extracts the user's messages from the conversation.
2. It infers the likely issue type (bug, feature request, or change request) from the session's classification tags.
3. It calls the `search_similar_issues` database function, which performs a vector similarity search scoped to the project.
4. Results above a similarity threshold of 0.5 are returned, ranked by similarity score.
5. Up to 5 candidate matches are passed to the PM Agent for evaluation.

### Similarity Thresholds

The system uses two key thresholds:

| Threshold | Behavior |
|-----------|----------|
| **0.7 and above** | The PM Agent treats this as a strong match and will upvote the existing issue rather than creating a new one. |
| **0.5 to 0.69** | The match is surfaced to the PM Agent as a candidate, but the agent evaluates whether the feedback truly describes the same problem before deciding. |
| **Below 0.5** | The candidate is excluded from results entirely. |

The PM Agent makes the final call. Even if a candidate scores above 0.7, the agent reads both the existing issue and the new feedback to confirm they describe the same underlying problem before upvoting.

### Including Closed Issues

By default, the duplicate search only considers open and in-progress issues. You can change this behavior in the project edit dialog on the **Dashboard** page by enabling **Include closed issues in deduplication**. When enabled, resolved and closed issues are also searched, which can be useful if customers report problems that were previously fixed but may have regressed.

## Upvoting

When the PM Agent determines that new feedback matches an existing issue, it upvotes that issue rather than creating a duplicate.

### What Happens During an Upvote

1. The existing issue's upvote count is incremented by one.
2. The feedback session is linked to the issue, preserving full traceability back to the original conversation.
3. The session is marked as PM-reviewed.
4. The Issue Analysis workflow is triggered to recompute scores, since the new session may bring additional customer data (ARR, company stage) that affects the impact calculation.
5. If the issue does not have a manual priority override, its priority is recalculated based on the new upvote count.

### Upvote-Based Priority Escalation

For issues without a manual priority override, the upvote count directly influences priority through a simple threshold system:

| Upvote Count | Priority |
|-------------|----------|
| 5 or more | High |
| 3 to 4 | Medium |
| 1 to 2 | Low |

This threshold-based escalation serves as a fallback. When the Issue Analysis workflow runs, it replaces this with a more sophisticated multi-factor priority that accounts for velocity, customer impact, and implementation effort.

### Viewing Linked Feedback

Each issue displays all of its linked feedback sessions in the issue detail view. You can click through to any session to read the full conversation, see which customer reported it, and understand the context behind each upvote.

## Embedding Lifecycle

Issue embeddings are managed automatically throughout the issue lifecycle:

- **On creation** -- An embedding is generated from the issue's title and description and stored in the `issue_embeddings` table.
- **On update** -- If the title or description changes, the embedding is regenerated. A content hash prevents unnecessary recomputation when the text has not actually changed.
- **On deletion** -- The embedding is removed via a database cascade.

## Manual Merge

In some cases, the automated system may create two issues that you later realize describe the same problem. You can merge issues manually from the issue detail view.

### How to Merge Issues

1. Open the issue you want to keep as the primary record.
2. Click **Merge** in the issue actions menu.
3. Search for and select the duplicate issue.
4. Confirm the merge.

When you merge two issues:

- All feedback sessions from the secondary issue are re-linked to the primary issue.
- The upvote count of the primary issue is updated to reflect the combined total.
- The secondary issue is archived.
- The primary issue's embedding is regenerated to reflect any changes to its description.

## Improving Deduplication Accuracy

The quality of deduplication depends on well-written issue titles and descriptions. The PM Agent is instructed to write specific, descriptive titles (for example, "Checkout button unresponsive on mobile Safari" rather than "Button doesn't work") and to include relevant context in descriptions. If you notice that the system is missing duplicates or creating false matches, you can:

- Edit issue titles and descriptions to be more specific. The embedding is automatically regenerated.
- Manually merge issues that the system missed.
- Adjust the **Include closed issues** setting if regressions are common in your product.
