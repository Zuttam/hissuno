---
name: hissuno-market-analysis
description: >
  Use when analyzing a product area or initiative - assessing demand, researching the market,
  evaluating competitors, and validating feasibility before committing to build.
  Triggers on: market analysis, initiative analysis, competitive analysis, demand validation,
  scope analysis, market research, TAM, competitor research.
  Requires the hissuno CLI to be configured.
license: MIT
metadata:
  author: hissuno
  version: "1.0"
---

# Market Analysis

Guides you through a structured market analysis for a product scope or initiative. Combines internal product signals from the Hissuno graph with external market research, enriches the graph with findings, and produces a synthesis with a recommendation.

## Prerequisites

- `hissuno` CLI configured and connected (`hissuno config show` to verify)
- Web search access for external research phases

## Workflow

### Phase 1: Internal Signal Gathering

**Step 1 - Identify the scope.**
Ask the user which product scope or initiative to analyze. If they're unsure, browse:

```bash
hissuno list scopes
```

Once identified, pull full details including goals and existing relationships:

```bash
hissuno get scopes <id>
```

**Step 2 - Aggregate demand signals.**
Search broadly across all entity types:

```bash
hissuno search "<scope name or area>"
```

Then collect structured data:
- Issues related to this area - count by type (bug/feature/change), review RICE scores and statuses
- Feedback mentioning this area - volume, sources (widget/Slack/Intercom/Gong), recency
- Traverse issue and feedback relationships to identify which companies are asking:

```bash
hissuno get issues <id>        # check relationships section for linked companies
hissuno get feedback <id>      # check relationships section for linked contacts/companies
```

**Step 3 - Assess existing knowledge.**
Search for prior art, documentation, and technical context:

```bash
hissuno search "<area>" --type knowledge
```

Review what's already been built or documented. Note gaps where knowledge is missing.

### Phase 2: External Research

Work through this checklist. Present it to the user at the start of this phase - they can skip items or add their own. Use web search and web fetch for each item.

**Competitive Landscape**
- [ ] Identify direct competitors offering similar capability
- [ ] For each competitor: pricing model, positioning, key differentiators
- [ ] How do competitors describe this problem space? What language do they use?
- [ ] Recent launches, pivots, or acquisitions in this space

**Market Context**
- [ ] Market size / TAM for this capability
- [ ] Industry trends - demand growing, stable, or declining?
- [ ] Analyst reports, blog posts, community discussions about this space
- [ ] Regulatory or compliance considerations

**Solution Landscape**
- [ ] Open-source alternatives or building blocks
- [ ] Common technical approaches / architectures
- [ ] Integration patterns - what do customers expect this to connect with?

**Customer Validation Signals**
- [ ] Community discussions (forums, Reddit, HN) about this problem
- [ ] Review sites - what do users say about existing solutions?
- [ ] Job postings mentioning this capability (indicates organizational demand)

### Phase 3: Graph Enrichment

Feed findings back into Hissuno so they're discoverable in future queries:

**Knowledge sources** - Add key URLs discovered during research (competitor pages, articles, reports, docs):

```bash
hissuno add knowledge
```

**Issues** - Create issues for gaps or competitive threats identified:

```bash
hissuno add issues
```

**Scope updates** - If the research surfaced insights that refine the scope's goals:

```bash
hissuno update scopes <id>
```

**Relationship linking** - Connect new knowledge and issues to the scope and to affected customers found in Phase 1. Use the relationship fields when creating/updating entities.

### Phase 4: Synthesis

Produce a structured analysis covering these sections:

1. **Demand Summary** - Internal signal strength: issue count, feedback volume, aggregate RICE scores, number of requesting customers
2. **Customer Impact Map** - Which companies are affected, their stages (prospect/active/churned), concentration risk
3. **Competitive Landscape** - Who else plays here, their positioning, where they're strong, where the gaps are
4. **Market Context** - Market size, trends, timing considerations
5. **Technical Landscape** - Existing approaches, open-source options, integration expectations
6. **Goal Alignment** - How findings map to the scope's stated goals
7. **Recommendation** - Pursue / defer / pivot, with supporting evidence from both internal and external research
8. **Open Questions** - What still needs answering before a decision

Ask the user if they want the synthesis saved as a markdown document, delivered conversationally, or both.

## Creating Your Own Workflow Skill

This is a workflow template. To create your own:

1. Create a new directory: `hissuno-<your-workflow-name>/`
2. Copy this `SKILL.md` as a starting point
3. Change the `name` and `description` frontmatter (description controls when the skill triggers)
4. Replace the phases with your procedure - use specific `hissuno` commands at each step
5. Install with `hissuno skills install`
