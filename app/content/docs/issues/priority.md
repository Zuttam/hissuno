---
title: "Priority Scoring"
description: "How Hissuno calculates issue priority using velocity, customer impact, and implementation effort."
---

## Overview

Hissuno uses a multi-factor algorithm to calculate issue priority automatically. Rather than relying on a single signal, the system combines three independent scores -- velocity, impact, and effort -- into a composite priority. This ensures that issues affecting high-value customers or gaining rapid traction rise to the top, while large-effort items are weighted appropriately.

## The Three Scoring Dimensions

Each dimension produces a score from 1 to 5. These scores are computed by the Issue Analysis workflow, which runs automatically after an issue is created or upvoted.

### Velocity Score

Velocity measures how quickly an issue is gaining traction. It is a purely algorithmic calculation based on session timestamps and upvote count, with no AI involvement.

The algorithm examines a 14-day rolling window and calculates:

- **Density** -- The number of linked feedback sessions per day within the window.
- **Acceleration** -- Whether the rate of new sessions is increasing or decreasing by comparing the recent half of the window to the older half.

| Score | Criteria |
|-------|----------|
| **5** | Density of 1 or more sessions per day with positive acceleration |
| **4** | Density of 0.5+ sessions per day, or 5 or more upvotes |
| **3** | Density of 0.25+ sessions per day, or 3-4 upvotes |
| **2** | 2 or more sessions in the 14-day window |
| **1** | Single mention or no recent activity |

An issue that is accelerating (more reports in the recent week than the prior week) receives a bonus notation in its reasoning, even if it does not yet meet a higher score threshold.

### Impact Score

Impact blends technical impact with customer data. The technical component is assessed by the Technical Analyst agent, which examines how the issue affects the product architecture, core workflows, and blast radius. The customer component is computed algorithmically from the linked feedback sessions.

**Customer impact factors:**

- **ARR at risk** -- Total annual recurring revenue across all affected companies.
  - $200K or more: score 5
  - $50K to $200K: score 4
  - $10K to $50K: score 3
  - Under $10K: score 2
  - No ARR data: score 1

- **Customer breadth** -- The number of unique companies and contacts affected.
  - 5 or more companies: score 5
  - 3-4 companies: score 4
  - 2 companies: score 3
  - 2 or more contacts from one company: score 2
  - Single contact: score 1

- **Customer stage weighting** -- Feedback from active and expansion customers carries more weight (1.2x and 1.3x multipliers respectively) than feedback from churned (1.1x), onboarding (1.0x), or prospect (0.8x) accounts.

The final customer score is a weighted blend: 60% ARR, 30% breadth, and 10% stage bonus.

**Blended impact formula:**

When a technical impact score is available (from codebase analysis), the final impact score is:

```
impact = technicalScore * 0.4 + customerScore * 0.6
```

When no codebase is connected, the impact score uses the customer score alone.

### Effort Score

Effort represents the estimated implementation complexity. It is assessed by the Technical Analyst agent when a codebase is connected, and maps to a 1-5 scale:

| Score | Estimate | Approximate Duration |
|-------|----------|---------------------|
| **1** | Trivial | Under 1 hour |
| **2** | Small | 1 to 4 hours |
| **3** | Medium | 1 to 2 days |
| **4** | Large | 3 to 5 days |
| **5** | X-Large | 1 week or more |

The agent considers the number of affected files, whether changes span multiple modules, whether database migrations are needed, and the scope of API surface changes.

## Computing the Composite Priority

The three scores are combined into a single composite value using weighted averages.

**When effort data is available:**

```
composite = velocity * 0.3 + impact * 0.5 + effortInverse * 0.2
```

Where `effortInverse = 6 - effortScore`. This means lower-effort issues receive a priority boost, since they deliver value with less investment.

**When effort data is not available** (no codebase connected):

```
composite = velocity * 0.35 + impact * 0.65
```

### Priority Mapping

The composite score maps to three priority levels:

| Composite Score | Priority |
|----------------|----------|
| 3.5 or higher | **High** |
| 2.0 to 3.49 | **Medium** |
| Below 2.0 | **Low** |

## When Priority Is Recalculated

The Issue Analysis workflow runs and recalculates priority:

- Immediately after an issue is created by the PM Agent.
- After an issue receives an upvote (new customer data may change impact scores).
- When you manually trigger analysis from the issue detail view by clicking **Re-analyze**.

## Manual Priority Override

You can override the computed priority at any time from the issue detail view. Click the priority badge and select a new level. When you set a manual override:

- The priority is locked to your chosen value.
- Subsequent automated recalculations will not change it.
- The override is indicated visually in the issue list.

To remove an override and return to automatic priority, click the priority badge and select **Use automatic priority**. The system will immediately recalculate the priority using the latest scores.

## Filtering by Score Levels

The issues list supports filtering by individual score dimensions. Each score maps to three filter levels:

| Filter Level | Score Range |
|-------------|-------------|
| High | 4-5 |
| Medium | 2-3 |
| Low | 1 |

You can combine these filters to find, for example, all high-impact issues with low effort -- a useful view for identifying quick wins.
