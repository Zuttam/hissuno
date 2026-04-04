---
title: "Churn Pattern Investigation - From Symptoms to Systemic Fix"
description: "An AI agent investigates churned and at-risk accounts, discovers shared product gaps through graph traversal, and builds a data-backed retention strategy."
---

# Churn Pattern Investigation - From Symptoms to Systemic Fix

A single prompt that drives an AI agent through a churn investigation. Starting from at-risk and churned accounts, the agent works backward through the knowledge graph to discover systemic product gaps, cross-references with market expectations, and produces a retention playbook with concrete product and relationship actions.

## What It Demonstrates

- **Bottom-up signal analysis**: Starts from customer pain, traces backward to root causes - the inverse of top-down planning.
- **Pattern recognition across accounts**: The agent must find commonalities across multiple customer journeys, not just analyze one.
- **Graph traversal in reverse**: Follows company -> contact -> feedback -> issues -> scopes to discover which product areas are driving churn.
- **Cohort analysis**: Groups customers by shared characteristics and shared pain to find structural problems.
- **Competitive loss detection**: Uses market research to distinguish "we failed" from "the market shifted."
- **Dual output**: Produces both a strategic report (what to fix in the product) and a tactical playbook (how to save specific accounts right now).

## Prerequisites

- Hissuno instance with customer data including company stages (active, churned, expansion)
- Feedback history across multiple accounts
- At least a few months of issue data for pattern detection
- Web search access for competitive and market research

## The Prompt

```
You are acting as an autonomous churn analyst. Your job is to investigate why customers are leaving or at risk, find the systemic product gaps driving churn, and produce a retention strategy.

Use the `hissuno` CLI to query and enrich the product graph (list, get, search, add, update commands). Use web search for external research. Do not ask me questions. Make decisions autonomously based on what the data tells you. Be direct about what you find, even if the conclusions are uncomfortable.

Here is the workflow. Execute every phase in sequence.

---

### Phase 1: Identify the Churn Cohort

Build a complete picture of accounts that have churned or are at risk:

1. List all companies with stage "churned". For each, pull full details including ARR, industry, plan tier, and renewal date.
2. List all companies with stage "active" that have a health score below 50. These are the at-risk accounts.
3. For both groups, pull all contacts at each company and assess their engagement level - when was their last feedback session? How many sessions total? Is their champion contact still active?

Produce an **Account Inventory**: a table of all churned and at-risk companies with their ARR, health score, contact count, last activity date, and champion status. Sort by ARR descending - the highest-value losses come first.

---

### Phase 2: Reconstruct Each Customer's Journey

For the top 5 accounts by ARR in the cohort:

1. Pull every feedback session from every contact at the company, ordered chronologically.
2. For each session, note the source (widget, Slack, Intercom, Gong), tags, and whether it resulted in an issue.
3. Map the sentiment trajectory over time. Look for:
   - The turning point - when did sentiment shift from positive/neutral to negative?
   - Escalation signals - did they move from widget to Slack to Gong calls? Channel escalation often precedes churn.
   - Silence patterns - did they go quiet before churning? Silence is a stronger churn signal than complaints.
4. List all issues linked to this company. Note which are still open, how long they've been open, and their priority.

For each account, produce a **Journey Timeline**: a chronological narrative of the customer's experience, highlighting the key inflection points and unresolved issues.

---

### Phase 3: Find the Shared Pain

Now look across all accounts in the cohort for patterns:

1. Collect all issues linked to churned and at-risk companies. Group them by product scope.
2. Identify the product scopes that appear across 3 or more accounts in the cohort - these are systemic, not isolated.
3. For each systemic scope, drill into the specific issues:
   - What types dominate? (bugs vs feature requests vs change requests)
   - What's the average age of open issues? Long-open issues signal neglect.
   - What goals within the scope are most affected?
4. Run semantic searches across the cohort's feedback for recurring language: phrases like "still broken", "we need", "switching to", "frustrated", "workaround". These surface pain that might not have been converted to issues.
5. Check if there are feedback sessions from the cohort that were reviewed but skipped by the PM agent - these might contain signals that were dismissed.

Produce a **Shared Pain Map**: product scopes ranked by churn correlation (how many churned/at-risk accounts they touch), with the specific issues and feedback themes under each.

---

### Phase 4: Competitive and Market Context

For the top 2 product scopes from the Shared Pain Map:

1. Research which competitors are strong in these areas. What do they offer that we don't?
2. Search for public discussions (Reddit, HN, review sites, forums) about switching from products like ours. What reasons do people give?
3. Check if any churned companies have publicly mentioned adopting a competitor (press releases, case studies, blog posts, LinkedIn posts from their team).
4. Assess whether the gap is a missing capability, a quality/reliability issue, or a pricing/positioning problem. These require different responses.

Produce a **Competitive Loss Analysis**: for each scope, describe what the market expects, where we fall short, and what competitors are doing differently.

---

### Phase 5: Segment and Classify

Not all churn has the same cause. Classify each account in the cohort into one of these segments:

1. **Product gap** - They need something we don't offer. Feature requests dominate their feedback.
2. **Quality/reliability** - They're frustrated by bugs, outages, or broken workflows. Bug reports and negative sentiment dominate.
3. **Neglect** - They reported issues that went unresolved for too long. Check for open issues older than 30 days linked to these accounts.
4. **Outgrown** - They've scaled beyond what our product supports. Look for enterprise-tier requests, performance complaints, or integration demands.
5. **Market shift** - External factors (acquisition, strategy change, budget cuts) drove the decision. Look for silence patterns and external signals.
6. **Champion loss** - Their internal champion left or went silent. Check for champion contacts with no recent activity.

An account can fit multiple segments. For each, note the primary and secondary classification with supporting evidence.

Produce a **Churn Segmentation Matrix**: accounts grouped by primary classification, with ARR totals per segment.

---

### Phase 6: Build the Retention Strategy

Now synthesize everything into an actionable strategy with two tracks:

**Track A: Product Fixes (Systemic)**

For each systemic product scope from the Shared Pain Map:
- What specific issues must be resolved? List them by ID with priority.
- What new capabilities are needed to close the competitive gap?
- What's the estimated impact? (Number of at-risk accounts retained, ARR preserved)
- Proposed timeline: immediate (this sprint), short-term (this quarter), long-term

**Track B: Account Recovery (Tactical)**

For each at-risk account (not yet churned):
- What's the specific pain? Reference their journey timeline.
- What's the fastest action that could change their trajectory? (Resolve a specific issue, schedule a call with their champion, offer a workaround)
- Who should reach out? (CS, engineering, product lead)
- What's the save probability? (High/medium/low based on sentiment trajectory and engagement level)

**Track C: Post-Mortem Actions**

For churned accounts:
- What should we have caught earlier? Identify the missed signal.
- Can we win them back? If so, what would need to change first?
- What monitoring should we add to catch this pattern in other accounts?

---

### Phase 7: Graph Enrichment

Feed findings back into Hissuno:

1. Create issues for every product gap identified that doesn't already have a tracked issue.
2. Update existing issues that are blocking retention - add context about churn impact to their descriptions or escalate priority.
3. For each at-risk account, add a note or update the company record with the recovery action plan.
4. If a new initiative scope is warranted (e.g., "Churn Recovery Sprint"), create it with specific goals tied to the findings.

---

### Phase 8: Executive Briefing

Produce a concise document (save as markdown) with:

- **The headline number**: Total ARR churned + total ARR at risk. This is the cost of inaction.
- **Root cause summary**: The 2-3 systemic product gaps driving churn, with evidence.
- **Churn segmentation**: How accounts break down by cause, with ARR per segment.
- **Competitive context**: Where the market is moving and where we're falling behind.
- **Immediate actions**: Top 5 things to do this week (specific issues to fix, accounts to call, monitoring to add).
- **Quarterly plan**: What the product roadmap should prioritize to structurally reduce churn.
- **Early warning system**: Signals to monitor so we catch the next wave before it happens.

The tone should be urgent but constructive. This is a diagnosis and a treatment plan, not a blame report.
```

## What the Agent Produces

By the end of execution, the agent will have:

| Output | Description |
|--------|-------------|
| **Account Inventory** | All churned and at-risk companies sorted by ARR with engagement metrics |
| **Journey Timelines** | Chronological narrative of each top account's experience and inflection points |
| **Shared Pain Map** | Product scopes ranked by churn correlation with specific issues and themes |
| **Competitive Loss Analysis** | Where we fall short vs market expectations and competitors |
| **Churn Segmentation Matrix** | Accounts classified by root cause with ARR per segment |
| **Retention Strategy** | Three-track plan: systemic product fixes, tactical account recovery, post-mortem learnings |
| **Executive Briefing** | Leadership-ready document with headline numbers, root causes, and action plan |
| **Graph artifacts** | New issues, updated priorities, company notes, and optional initiative scope in Hissuno |


## Adapting This Prompt

- **Narrow the cohort**: Add "Focus only on enterprise accounts with ARR above $50K" to filter the investigation
- **Single account mode**: Replace Phase 1 with "Investigate [Company Name]" for a targeted deep dive
- **Add win-back focus**: Append "For churned accounts, draft a personalized win-back email to each champion contact"
- **Expand monitoring**: Add a phase for defining health score thresholds and alert rules based on the patterns found
- **Industry filter**: Add "Focus on accounts in the fintech vertical" to investigate segment-specific churn
