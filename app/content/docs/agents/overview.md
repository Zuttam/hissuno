---
title: "Overview"
description: "An introduction to the Hissuno Agent system — how AI agents power customer support and product management."
---

## The Hissuno Agent System

Hissuno includes two AI agents that work together to handle customer conversations and turn them into product insights.

### Support Agent

The Support Agent is Hissuno's customer-facing AI. It uses your product knowledge — extracted from your codebase, documentation, and configured knowledge sources — to answer customer questions in real time. It handles common queries autonomously and escalates complex issues to your human support team.

[Learn more about the Support Agent](/docs/agents/support-agent)

### PM Copilot

The PM Copilot is Hissuno's automated product manager. It reviews every customer feedback session, identifies actionable product insights, and maintains a living backlog of customer-reported issues. When enough customers report the same problem, it generates a product specification to help your team move from feedback to implementation.

[Learn more about the PM Copilot](/docs/agents/pm-copilot)

## How They Work Together

The two agents form a continuous feedback loop:

1. **Support Agent** handles customer conversations, answering questions and collecting feedback
2. **PM Copilot** reviews each conversation after it ends, extracting product insights
3. Issues are created or upvoted automatically based on customer feedback
4. When an issue reaches a critical mass of reports, a spec can be generated

This pipeline runs automatically for every conversation — whether it comes from the widget, Slack, Intercom, or Gong.

## Configuring Agents

Both agents are configurable from the **Agents** page in the sidebar. Each agent has its own configuration card where you can customize behavior, guidelines, and thresholds.
