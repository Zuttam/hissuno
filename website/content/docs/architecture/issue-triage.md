---
title: "Issue Triage"
description: "How Hissuno deduplicates issues, scores priority using velocity/impact/effort, and generates product specs."
---

## Overview

After an issue enters the [knowledge graph](/docs/architecture/knowledge-graph), the triage layer handles three responsibilities: detecting and consolidating duplicates, computing a multi-factor priority score, and generating product specifications. These processes run automatically as part of the Issue Analysis workflow, which is triggered whenever an issue is created or upvoted.

## Deduplication

Hissuno uses [vector embeddings](/docs/architecture/embeddings) and cosine similarity to detect when multiple customers report the same problem. When a match is found, the existing issue is upvoted instead of creating a duplicate, and the new feedback is linked for full traceability.

### Similarity Thresholds

During [feedback ingestion](/docs/architecture/resource-ingestion), the system generates an embedding from the customer's messages and compares it against all existing issue embeddings in the project.

| Threshold | Behavior |
|-----------|----------|
| **0.7 and above** | Strong match. The PM Agent upvotes the existing issue rather than creating a new one. |
| **0.5 to 0.69** | Candidate match. The PM Agent evaluates whether the feedback truly describes the same problem before deciding. |
| **Below 0.5** | Excluded from results entirely. |

The PM Agent makes the final call. Even if a candidate scores above 0.7, the agent reads both the existing issue and the new feedback to confirm they describe the same underlying problem.

### What Happens During an Upvote

1. The existing issue's upvote count is incremented.
2. The feedback is linked to the issue, preserving traceability back to the original conversation.
3. The feedback is marked as PM-reviewed.
4. The Issue Analysis workflow is triggered to recompute scores, since the new feedback may bring additional customer data (ARR, company stage) that affects the impact calculation.
5. If the issue does not have a manual priority override, its priority is recalculated.

### Including Closed Issues

By default, the duplicate search only considers open and in-progress issues. You can enable **Include closed issues in deduplication** in the project settings. This is useful when customers report problems that were previously fixed but may have regressed.

### Manual Merge

If the automated system creates two issues that you later realize describe the same problem, you can merge them from the issue detail view. Merging re-links all feedback from the secondary issue to the primary, updates the combined upvote count, and archives the secondary issue.

## Priority Scoring

Hissuno uses a multi-factor algorithm to calculate issue priority automatically. The system combines three independent scores - velocity, impact, and effort - into a composite priority. Each dimension produces a score from 1 to 5.

### Velocity

Velocity measures how quickly an issue is gaining traction. It is a purely algorithmic calculation based on feedback timestamps and upvote count, with no AI involvement. The algorithm examines a 14-day rolling window.

| Score | Criteria |
|-------|----------|
| **5** | Density of 1+ reports per day with positive acceleration |
| **4** | Density of 0.5+ reports per day, or 5+ upvotes |
| **3** | Density of 0.25+ reports per day, or 3-4 upvotes |
| **2** | 2+ reports in the 14-day window |
| **1** | Single mention or no recent activity |

Acceleration is measured by comparing the recent half of the window to the older half. An issue that is accelerating receives a bonus notation in its reasoning.

### Impact

Impact blends technical analysis with customer data.

**Technical impact** is assessed by the Technical Analyst agent, which examines how the issue affects the product architecture, core workflows, and blast radius.

**Customer impact** is computed algorithmically from linked feedback using three factors:

- **ARR at risk** - Total annual recurring revenue across all affected companies. Scored from 1 (no ARR data) to 5 ($200K+).
- **Customer breadth** - Number of unique companies and contacts affected. Scored from 1 (single contact) to 5 (5+ companies).
- **Customer stage weighting** - Expansion customers carry a 1.3x multiplier, active customers 1.2x, churned 1.1x, onboarding 1.0x, and prospects 0.8x.

The final customer score is a weighted blend: 60% ARR, 30% breadth, 10% stage bonus.

**Blended impact formula** (when codebase is connected):

```
impact = technicalScore * 0.4 + customerScore * 0.6
```

When no codebase is connected, the impact score uses the customer score alone.

### Effort

Effort represents the estimated implementation complexity, assessed by the Technical Analyst agent when a codebase is connected.

| Score | Estimate | Approximate Duration |
|-------|----------|---------------------|
| **1** | Trivial | Under 1 hour |
| **2** | Small | 1 to 4 hours |
| **3** | Medium | 1 to 2 days |
| **4** | Large | 3 to 5 days |
| **5** | X-Large | 1 week or more |

The agent considers the number of affected files, whether changes span multiple modules, whether database migrations are needed, and the scope of API surface changes.

### Composite Priority

The three scores are combined into a single composite value:

```
composite = velocity * 0.3 + impact * 0.5 + effortInverse * 0.2
```

Where `effortInverse = 6 - effortScore`. Lower-effort issues receive a priority boost since they deliver value with less investment. When effort data is not available (no codebase connected), the formula falls back to `velocity * 0.35 + impact * 0.65`.

### Priority Mapping

| Composite Score | Priority |
|----------------|----------|
| 3.5 or higher | **High** |
| 2.0 to 3.49 | **Medium** |
| Below 2.0 | **Low** |

### When Priority Is Recalculated

The Issue Analysis workflow runs and recalculates priority:

- Immediately after an issue is created by the PM Agent.
- After an issue receives an upvote (new customer data may change impact scores).
- When you manually trigger analysis from the issue detail view.

### Manual Priority Override

You can override the computed priority at any time from the issue detail view. When you set a manual override, the priority is locked and subsequent automated recalculations will not change it. You can remove the override to return to automatic priority at any time.

## Spec Generation

Once an issue has gathered enough evidence from customer feedback, Hissuno can generate a comprehensive product specification. The **Spec Writer Agent** researches the issue using the knowledge base, codebase, and web sources, then produces a structured document that bridges user needs with technical implementation.

### Generation Process

The Spec Writer Agent follows a structured research process:

1. **Gather context** - Collects the issue details, all linked feedback with full message histories, and project information.
2. **Search the knowledge base** - Queries your project's compiled knowledge for relevant product documentation, technical specifications, and existing patterns.
3. **Analyze the codebase** - If a codebase is connected, the agent explores the project structure, searches for relevant code, and reviews implementations.
4. **Research best practices** - Performs web searches to find how competitors solve similar problems and discover industry patterns.
5. **Write the specification** - Synthesizes all research into a structured document.

### Spec Structure

Every generated specification follows a consistent template:

- **Executive Summary** - Two-to-three sentence overview of the problem and proposed solution direction.
- **Problem Statement** - User pain points with direct quotes from customer feedback, plus business impact analysis.
- **Evidence Base** - User feedback quotes, technical context from codebase analysis, and market research from web search.
- **Proposed Solution** - High-level approach, user experience, technical considerations, and database/data changes.
- **Acceptance Criteria** - Numbered list of specific, testable criteria using the "When X, then Y" format.
- **Out of Scope** - Explicit list of what the spec does not cover and features deferred to future iterations.
- **Open Questions** - Unresolved items that need stakeholder or engineering input before implementation can begin.

### Jira Sync

When your project has a Jira integration enabled, spec generation triggers a sync action. After the spec is saved, Hissuno adds a comment to the linked Jira ticket with a link back to the full spec. This keeps your engineering team informed without duplicating the entire spec content in Jira.
