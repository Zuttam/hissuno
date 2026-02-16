---
title: "Support Agent"
description: "Learn how the AI Support Agent uses product knowledge to handle customer conversations and escalate when needed."
---

## Overview

The Support Agent is Hissuno's customer-facing AI that powers real-time conversations with your customers. It uses knowledge extracted from your codebase, documentation, and configured knowledge sources to provide accurate, contextual answers to customer questions.

The agent is designed to handle common support queries autonomously while knowing when to escalate complex issues to your human support team.

## How It Works

### Knowledge-Powered Responses

The Support Agent does not rely on generic AI knowledge. Instead, it draws from a curated knowledge base built specifically for your product:

1. **Codebase knowledge** -- Extracted from your connected GitHub repository by the Codebase Analyzer agent, covering features, API behavior, configuration options, and product capabilities
2. **Documentation** -- Content from your knowledge sources including help docs, guides, and FAQs
3. **Custom knowledge** -- Manually added knowledge entries that address specific topics or edge cases

When a customer asks a question, the agent searches across all knowledge sources to find relevant information before generating a response.

### Knowledge Retrieval Flow

```
Customer message
    |
    v
Query analysis --> Identify intent and key topics
    |
    v
Knowledge search --> Search across all knowledge packages
    |
    v
Context assembly --> Combine relevant knowledge chunks
    |
    v
Response generation --> Generate answer grounded in context
    |
    v
Response to customer
```

The agent only answers based on available knowledge. If no relevant knowledge is found, it acknowledges the limitation and offers to connect the customer with a human agent.

## Conversation Handling

### Session Lifecycle

Each customer interaction is tracked as a feedback session:

1. **Session created** -- When a customer initiates a conversation through the widget or an integrated channel
2. **Agent responds** -- The Support Agent handles the conversation, answering questions and providing guidance
3. **Session reviewed** -- After the conversation, the PM Agent reviews the session for product feedback
4. **Issues extracted** -- Any feature requests, bugs, or concerns are captured as issues

### Multi-Turn Conversations

The Support Agent maintains full conversation context throughout a session. It remembers previous messages, follows up on earlier topics, and avoids repeating itself. The context window includes:

- All messages in the current session
- Customer profile information (name, company, previous interactions)
- Relevant knowledge retrieved for each message

### Response Style

The agent generates responses that are:

- **Concise** -- Answers the question directly without unnecessary preamble
- **Accurate** -- Grounded in your product knowledge, not general assumptions
- **Helpful** -- Includes next steps or links when appropriate
- **Professional** -- Maintains a consistent tone aligned with your brand

## Escalation

### When Escalation Happens

The Support Agent escalates to a human when:

- The customer explicitly requests to speak with a person
- The agent cannot find relevant knowledge to answer the question
- The conversation involves sensitive topics such as billing disputes, account security, or legal matters
- The customer expresses significant frustration that the agent cannot resolve
- The query requires access to internal systems or data the agent cannot reach

### Escalation Flow

When escalation is triggered:

1. The agent informs the customer that a human team member will follow up
2. The session is flagged with an escalation status
3. A notification is sent to your configured channel (Slack, email, or in-app)
4. The full conversation history is available to the human agent for context

### Escalation Notifications

Escalation alerts are sent through your configured notification channels (Slack or in-app notifications on the Hissuno dashboard).

## Customizing Agent Behavior

You can customize the Support Agent by navigating to the **Agents** page, then clicking **Configure** on the Support Specialist card. The configuration dialog provides the following settings:

### Tone of Voice

Set the overall tone for the agent's responses. This guides how the agent communicates -- for example, formal and professional, friendly and conversational, or technical and precise.

### Brand Guidelines

Provide brand-specific instructions that guide the agent's behavior. This field accepts plain text describing your preferences. For example:

```
You are the support agent for Acme Corp. Always greet customers by name
when available. If a question is about pricing, direct the customer to
our pricing page at https://acme.com/pricing rather than quoting numbers.
Never discuss competitor products. For API questions, always include a
code example when possible.
```

### Knowledge Package

Select which knowledge package the agent uses to answer questions. The agent draws from a single assigned knowledge package that contains your product and codebase knowledge. Knowledge packages are built from your connected GitHub repository and configured knowledge sources.

## Widget Configuration

The Support Agent is typically deployed through the Hissuno widget. Widget appearance and behavior are configured separately on the **Integrations** page -- navigate to **Integrations** in the sidebar and click **Configure** on the Widget card.

## Monitoring Performance

Track how well the Support Agent is handling conversations from the **Dashboard** page. Key metrics include:

- **Resolution rate** -- Percentage of sessions resolved without escalation
- **Average response time** -- How quickly the agent responds
- **Escalation reasons** -- Breakdown of why conversations were escalated
