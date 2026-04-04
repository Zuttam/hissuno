---
title: "Support Agent"
description: "How the Hissuno Support Agent uses compiled knowledge packages to handle customer conversations, escalate when needed, and integrate with your support channels."
---

## Overview

The Hissuno Agent is Hissuno's customer-facing AI that powers real-time conversations with your customers. It uses knowledge extracted from your codebase, documentation, and configured knowledge sources to provide accurate, contextual answers to customer questions.

The agent is designed to handle common support queries autonomously while knowing when to escalate complex issues to your human support team.

## How It Works

### Knowledge-Powered Responses

The Hissuno Agent does not rely on generic AI knowledge. Instead, it draws from a curated knowledge base built specifically for your product:

1. **Codebase knowledge** - Extracted from your connected GitHub repository by the Codebase Analyzer agent, covering features, API behavior, configuration options, and product capabilities
2. **Documentation** - Content from your knowledge sources including help docs, guides, and FAQs
3. **Custom knowledge** - Manually added knowledge entries that address specific topics or edge cases

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

### Feedback Lifecycle

Each customer interaction is tracked as a feedback entry (called a *session* in the code and API):

1. **Feedback created** - When a customer initiates a conversation through the widget or an integrated channel
2. **Agent responds** - The Hissuno Agent handles the conversation, answering questions and providing guidance
3. **Feedback reviewed** - After the conversation, the PM Agent reviews the feedback for product insights
4. **Issues extracted** - Any feature requests, bugs, or concerns are captured as issues

### Multi-Turn Conversations

The Hissuno Agent maintains full conversation context throughout a feedback conversation. It remembers previous messages, follows up on earlier topics, and avoids repeating itself. The context window includes:

- All messages in the current conversation
- Customer profile information (name, company, previous interactions)
- Relevant knowledge retrieved for each message

### Response Style

The agent generates responses that are:

- **Concise** - Answers the question directly without unnecessary preamble
- **Accurate** - Grounded in your product knowledge, not general assumptions
- **Helpful** - Includes next steps or links when appropriate
- **Professional** - Maintains a consistent tone aligned with your brand

## Escalation

### When Escalation Happens

The Hissuno Agent escalates to a human when:

- The customer explicitly requests to speak with a person
- The agent cannot find relevant knowledge to answer the question
- The conversation involves sensitive topics such as billing disputes, account security, or legal matters
- The customer expresses significant frustration that the agent cannot resolve
- The query requires access to internal systems or data the agent cannot reach

### Escalation Flow

When escalation is triggered:

1. The agent informs the customer that a human team member will follow up
2. The feedback is flagged with an escalation status
3. A notification is sent to your configured channel (Slack, email, or in-app)
4. The full conversation history is available to the human agent for context

### Escalation Notifications

Escalation alerts are sent through your configured notification channels (Slack or in-app notifications on the Hissuno dashboard).

## Knowledge Packages

Knowledge packages are the compiled output of the analysis workflow. They take the raw information extracted from your knowledge sources and organize it into structured categories that the Hissuno Agent can reference when answering customer questions.

### Package Categories

Every analysis run produces five distinct knowledge packages:

- **Business** - Company-level information such as pricing details, policies, contact information, company background, and go-to-market positioning
- **Product** - Features, capabilities, use cases, and limitations of your product. Typically the most referenced package during customer conversations
- **Technical** - API references, architecture details, data models, integration guides, and infrastructure information
- **FAQ** - Frequently asked questions and answers organized by topic, generated by identifying common question patterns across your source materials
- **How-To** - Step-by-step tutorials, getting-started guides, and best practice documentation

### Compilation

After your knowledge sources are analyzed (see [Resource Ingestion](/docs/architecture/resource-ingestion) for the source analysis pipeline), the Knowledge Compiler agent receives all analysis results and categorizes them into the five packages listed above. The compiler uses structured output to return a JSON object with each category as a key, ensuring consistent formatting across runs.

### Security and Sanitization

Before packages are saved, they pass through a security sanitization step. The Security Scanner agent scans all compiled content for sensitive information including API keys, tokens, secrets, database connection strings, passwords, AWS credentials, private keys, and internal IP addresses. Sensitive values are replaced with descriptive placeholders like `[REDACTED_API_KEY]` or `[REDACTED_DATABASE_URL]`. A summary of redactions is logged with the total count and types of sensitive data found across each category. This ensures that secrets from your codebase or documentation never leak into the knowledge that the Hissuno Agent shares with customers.

### Named Packages

For projects that cover more than one product or serve distinct audiences, you can create named packages. A named package groups specific knowledge sources together with their own guidelines and produces its own set of five category packages. This is useful for multi-product projects, audience segmentation, or regional variations.

### How Packages Power Responses

When the Hissuno Agent receives a customer message, it converts the message to a vector embedding and performs a semantic search against indexed knowledge chunks to find the most relevant content. The matched content can span one or more package categories, giving the agent context from multiple angles (product, technical, FAQ, and so on). The agent then synthesizes a response using the retrieved knowledge, ensuring answers are grounded in your actual product documentation and codebase rather than generic assumptions.

## Customizing Agent Behavior

You can customize the Hissuno Agent by navigating to the **Agents** page, then clicking **Configure** on the Support Specialist card. The configuration dialog provides the following settings:

### Tone of Voice

Set the overall tone for the agent's responses. This guides how the agent communicates - for example, formal and professional, friendly and conversational, or technical and precise.

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

The Hissuno Agent is typically deployed through the Hissuno widget. Widget appearance and behavior are configured separately - navigate to **Integrations** in the sidebar and click **Configure** on the Widget card. See the [Widget documentation](/docs/integrations/widget) for details.
