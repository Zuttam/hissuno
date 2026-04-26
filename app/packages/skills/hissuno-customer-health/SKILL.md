---
name: hissuno-customer-health
description: >
  Use when analyzing a customer account - understanding their feedback history, open issues,
  contact activity, sentiment trajectory, and overall health.
  Triggers on: customer health, account review, customer deep dive, account analysis,
  churn risk, customer assessment, renewal prep, account health check.
  Requires the hissuno CLI to be configured.
version: "1.0"
license: MIT
metadata:
  author: hissuno
triggers:
  manual: { entity: customer }
  scheduled: { cron: '0 8 * * 1' }
input:
  customerId:
    type: string
    required: true
    description: ID of the customer (contact or company) to analyze.
capabilities:
  sandbox: true
  webSearch: true
---

# Customer Health Deep Dive

Guides you through a structured health assessment for a customer account. Maps the account's contacts, collects internal signals from the Hissuno graph, gathers external context, enriches the graph with findings, and produces an actionable health assessment.

## Prerequisites

- `hissuno` CLI configured and connected (`hissuno config show` to verify)
- Web search access for external context phases

## How this run is scoped

Two ways this skill is invoked:

1. **Per-customer** (manual button or `customer.created` event). The harness sets `$CUSTOMER_ID`. Run the workflow once for that customer.
2. **No entity given** (weekly scheduled sweep). `$CUSTOMER_ID` is empty. Enumerate active companies for the project and run the workflow for each in turn:

```bash
if [ -z "$CUSTOMER_ID" ]; then
  hissuno list customers --customer-type companies --status active --json > companies.json
  for COMPANY_ID in $(jq -r '.[].id' companies.json); do
    echo "--- analyzing $COMPANY_ID ---"
    CUSTOMER_ID="$COMPANY_ID" /usr/bin/env -- bash -c '...phases below...'
  done
  exit 0
fi
```

For sequential per-customer runs, cap yourself at the top 20 highest-ARR active accounts to stay under the daily run cap. (Raise `dailyRunCap` in this skill's frontmatter if a project consistently has more.)

## Workflow

### Phase 1: Account Mapping

**Step 1 - Identify the customer.**
Use `$CUSTOMER_ID` from the harness, or for ad-hoc runs:

```bash
hissuno list customers --customer-type companies
```

Pull full details including stage, metadata, and relationships:

```bash
hissuno get customers "$CUSTOMER_ID" --customer-type companies
```

**Step 2 - Map contacts.**
Get all people at the company:

```bash
hissuno list customers --company-id <company-id>
```

For key contacts, pull individual details and relationships:

```bash
hissuno get customers <contact-id>
```

Build the contact map: who are they, what roles, how active, who's the champion vs end-user vs decision-maker?

### Phase 2: Signal Collection

**Feedback History**

For each key contact, pull their feedback sessions:

```bash
hissuno list feedback --contact-id <contact-id>
```

Read recent sessions for tone, topics, and recurring themes:

```bash
hissuno get feedback <session-id>
```

Assess:
- Sentiment trajectory - improving, stable, or declining?
- Communication sources (widget, Slack, Intercom, Gong) - where does this customer prefer to engage?
- Recurring themes - what keeps coming up?

**Open Issues**

From the company's relationships (visible in the `get` output), identify linked issues. For each:

```bash
hissuno get issues <issue-id>
```

Check:
- Status, priority, RICE scores, age
- Are there unresolved high-priority issues? How long have they been open?
- Patterns - mostly bugs? Feature requests? Change requests?

**Product Scope Mapping**

From the issues found above, traverse to product scopes (visible in issue relationships):

```bash
hissuno get scopes <scope-id>
```

- Which product areas does this customer use or care about most?
- Are their pain points concentrated in one scope or spread across many?

### Phase 3: External Context

Work through this checklist. Present it to the user at the start of this phase - they can skip items or add their own. Use web search and web fetch for each item.

**Company Intelligence**
- [ ] Company website - recent news, product launches, strategy shifts
- [ ] LinkedIn company page - headcount trends, recent hires, job postings
- [ ] Funding / financial events (if relevant)
- [ ] Industry context - growing or contracting market?

**Relationship Context**
- [ ] Key contacts on LinkedIn - role changes, posts, activity
- [ ] Public case studies, testimonials, or reviews they've written
- [ ] Conference talks or blog posts from their team

### Phase 4: Graph Enrichment

Feed findings back into Hissuno:

**Create issues** - For untracked pain points surfaced during the review:

```bash
hissuno add issues
```

**Add knowledge** - Key URLs discovered (company blog, relevant articles):

```bash
hissuno add knowledge
```

**Link relationships** - Connect newly discovered signals to the company and its contacts. Use the relationship fields when creating/updating entities.

### Phase 5: Synthesis

Produce a structured health assessment covering these sections:

1. **Account Overview** - Company stage, contact count, activity level, primary communication channels
2. **Contact Map** - Key people, their roles, engagement levels, who's the champion
3. **Sentiment Assessment** - Overall trajectory with specific evidence from feedback sessions
4. **Risk Factors** - Unresolved high-priority issues, declining engagement, negative sentiment patterns, champion departure
5. **Opportunity Signals** - Feature interest indicating expansion, advocacy potential, upsell indicators
6. **Product Engagement** - Which scopes they touch, depth of usage, areas of concentration
7. **Action Items** - Concrete next steps: resolve issue X, reach out to contact Y, schedule check-in with Z

Ask the user if they want the assessment saved as a markdown document, delivered conversationally, or both.

## Creating Your Own Workflow Skill

This is a workflow template. To create your own:

1. Create a new directory: `hissuno-<your-workflow-name>/`
2. Copy this `SKILL.md` as a starting point
3. Change the `name` and `description` frontmatter (description controls when the skill triggers)
4. Replace the phases with your procedure - use specific `hissuno` commands at each step
5. Install with `hissuno skills install`
