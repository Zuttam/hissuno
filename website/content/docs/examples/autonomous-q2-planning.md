---
title: "Autonomous Q2 Planning - From Signals to Strategy"
description: "A complete quarterly planning cycle driven by an AI agent - from raw signal analysis to a prioritized roadmap recommendation."
---

# Autonomous Q2 Planning - From Signals to Strategy

A single prompt that drives an AI agent through a complete quarterly planning cycle. The agent surveys your product landscape, identifies demand signals, assesses customer health, researches the market, and produces a prioritized roadmap recommendation - all without human intervention between steps.

## What It Demonstrates

- **End-to-end autonomy**: 8 phases, zero human intervention. The agent makes every decision.
- **Multi-skill orchestration**: Chains graph queries, customer health assessment, and market analysis without artificial seams.
- **Real product judgment**: The agent weighs competing signals - churn risk vs market opportunity vs technical debt.
- **Graph traversal depth**: 3-4 hop traversals (scope -> issues -> companies -> contacts -> feedback).
- **Bidirectional data flow**: The agent reads from and writes back to the knowledge graph.
- **Opinionated output**: Forces pursue/defer/pivot decisions and explicit deprioritization, not a menu of options.

## Prerequisites

- Hissuno instance with product data (issues, feedback, customers, scopes)
- At least one integration connected (Intercom, Slack, Gong, etc.) for richer feedback data
- Web search access for the market analysis phase

## The Prompt

```
You are acting as an autonomous product strategist. Your job is to run a complete Q2 planning cycle for our product - from raw signal analysis to a prioritized roadmap recommendation.

Use the `hissuno` CLI to query and enrich the product graph (list, get, search, add, update commands). Use web search for external market research. Do not ask me questions. Make decisions autonomously based on what the data tells you. I want to see the agent think like a product leader.

Here is the workflow. Execute every phase in sequence.

---

### Phase 1: Product Landscape Survey

Map the current state of the product:

1. List all product scopes. For each scope, pull full details including goals and relationships.
2. List all open issues grouped by priority (high, medium, low). Note the total count and type distribution (bugs vs feature requests vs change requests) per priority level.
3. Pull recent feedback sessions across all sources (widget, slack, intercom, gong). Identify the top recurring themes.
4. Run semantic searches for broad problem areas: "performance", "onboarding", "integrations", "reporting", "pricing" - and any other themes that emerge from the feedback.

Produce a **Signal Density Map**: for each product scope, count the number of linked issues (by type and priority), feedback sessions, and requesting companies. Rank scopes by total signal density.

---

### Phase 2: Customer Impact Analysis

From the Signal Density Map, identify the top 3 product scopes by demand.

For each:
1. Traverse the graph from scope -> issues -> companies to build a list of affected customers.
2. For each affected company, pull their stage, ARR, health score, and renewal date.
3. Flag companies where: health score < 60, stage is "churned" or "active" with renewal in the next 90 days, or they have 3+ open high-priority issues.

Produce a **Customer Risk Matrix**: which high-value customers are at risk, what product areas are causing the pain, and what's the aggregate ARR at stake.

---

### Phase 3: Deep Dive - Highest-Risk Account

Take the single highest-risk customer from the matrix (highest ARR with lowest health score) and run a full customer health assessment:

1. Map all contacts at the company. Identify champions, decision-makers, and end-users.
2. Pull every feedback session from their contacts. Assess sentiment trajectory - improving, stable, or declining?
3. List all open issues linked to this company. Note age, priority, and whether they're in the top-demand product scopes.
4. Map which product scopes this customer touches most heavily.
5. Research the company externally - recent news, funding, hiring trends, any signals of strategic shift.

Produce a **Customer Health Brief** with: account overview, contact map, sentiment assessment, risk factors, opportunity signals, and concrete action items.

---

### Phase 4: Market Analysis - Top Initiative

Take the #1 product scope by signal density and run a full market analysis:

1. Aggregate all internal demand signals - issue count by type, feedback volume, RICE scores, number of requesting customers and their aggregate ARR.
2. Research the competitive landscape - who else solves this problem, how they position it, pricing, recent moves.
3. Research the broader market - TAM, growth trends, analyst perspectives, community discussions (Reddit, HN, forums).
4. Identify open-source alternatives and common technical approaches.
5. Assess how findings map to the scope's stated goals.

Produce a **Market Analysis Brief** with: demand summary, customer impact map, competitive landscape, market context, technical landscape, goal alignment, and a pursue/defer/pivot recommendation with evidence.

---

### Phase 5: Cross-Reference and Synthesize

Now bring everything together:

1. Overlay the Customer Risk Matrix onto the Market Analysis. Are the customers at highest churn risk also the ones demanding the top initiative? If so, that's a strong signal to prioritize.
2. Identify any "two birds, one stone" opportunities - initiatives that simultaneously address churn risk AND capture market opportunity.
3. Check for conflicts - are there high-priority bugs in foundational scopes that could undermine new initiative work?
4. Assess resource implications - how many open issues need resolution before new work can begin?

---

### Phase 6: Q2 Roadmap Recommendation

Produce a structured Q2 roadmap recommendation:

**1. Strategic Theme** - one sentence describing the quarter's focus and why.

**2. Priority Stack** (ordered):
For each recommended initiative:
- Name and scope
- Internal demand evidence (issue count, feedback volume, customer count, ARR at stake)
- External validation (market size, competitive pressure, timing)
- Customer risk mitigation (which at-risk accounts this helps retain)
- Key goals and success metrics
- Dependencies and risks

**3. Debt and Stability Work**
- Critical bugs that must ship regardless of strategic priorities
- Infrastructure or foundational issues blocking initiative work

**4. What We're NOT Doing and Why**
- Scopes or requests we're explicitly deprioritizing this quarter, with reasoning

**5. Key Account Actions**
- Specific outreach, escalations, or relationship actions for at-risk customers

---

### Phase 7: Graph Enrichment

Feed your findings back into Hissuno so they persist:

1. Create a new product scope (initiative type) for the top Q2 initiative with specific, measurable goals.
2. Create issues for any gaps identified during market analysis (competitive threats, missing capabilities).
3. Link newly created entities to affected companies and existing issues.
4. Update any existing scopes whose goals should be refined based on the analysis.

---

### Phase 8: Stakeholder Brief

Finally, produce a concise, stakeholder-ready document (save as markdown) that covers:
- Executive summary (3 sentences)
- Q2 strategic theme
- Top 3 priorities with one-paragraph justifications
- Key account risks and actions
- What we're cutting and why
- Open questions for leadership

The tone should be decisive, data-backed, and opinionated. This is a recommendation, not a menu of options.
```

## What the Agent Produces

By the end of execution, the agent will have:

| Output | Description |
|--------|-------------|
| **Signal Density Map** | Product scopes ranked by issue count, feedback volume, and requesting companies |
| **Customer Risk Matrix** | At-risk accounts with ARR at stake, mapped to problem areas |
| **Customer Health Brief** | Deep assessment of the highest-risk account with action items |
| **Market Analysis Brief** | Competitive landscape, market context, and pursue/defer/pivot recommendation |
| **Q2 Roadmap Recommendation** | Prioritized initiative stack with explicit deprioritization |
| **Stakeholder Brief** | Leadership-ready markdown document |
| **Graph artifacts** | New initiatives, issues, and relationships persisted in Hissuno |

## Complexity Vectors

| Dimension | How It's Exercised |
|-----------|-------------------|
| Graph traversal | Multi-hop: scope -> issue -> company -> contact -> feedback |
| Semantic search | Broad thematic searches + targeted entity lookups |
| External research | Competitive landscape, market sizing, company intelligence |
| Data enrichment | Creates initiatives, issues, links - writes back to graph |
| Cross-referencing | Overlays customer risk onto market opportunity |
| Synthesis | Produces 4 distinct structured analyses + final recommendation |
| Decision-making | Prioritization, deprioritization, pursue/defer/pivot calls |

## Adapting This Prompt

- **Change the quarter**: Replace "Q2" with your planning period
- **Narrow the scope**: Add "Focus only on the API Platform scope" to skip the landscape survey
- **Skip market research**: Remove Phase 4 if you only want internal signal analysis
- **Add constraints**: Prepend "We have 2 engineers and a 6-week timeline" to force tighter prioritization
- **Different output format**: Replace Phase 8 with your preferred stakeholder format (Notion page, slide outline, etc.)
