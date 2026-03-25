---
title: "Feedback Overview"
description: "Understand how customer feedback sessions capture conversations and flow through Hissuno's review pipeline."
---

## Overview

Feedback sessions are the core data unit in Hissuno. Each session represents a single customer interaction, whether it is a live chat conversation, a synced support ticket, a sales call transcript, or behavioral event data. Sessions capture the full context of what a customer communicated and what actions were taken.

Every session flows through an automated pipeline: it is captured from a source, optionally handled by the Hissuno Agent, classified with tags, reviewed by the PM agent, and potentially converted into an engineering issue.

## What is a Feedback Session?

A feedback session contains:

- **Messages**: The full conversation history between the customer and the Hissuno Agent (or human agent)
- **Metadata**: Customer identity, source channel, page URL, timestamps, and any custom metadata passed by the integration
- **Tags**: Classification labels applied either automatically by AI or manually by your team
- **Contact**: The matched customer contact record, resolved from email or metadata
- **Linked Issues**: Any engineering issues created or upvoted as a result of reviewing the session

Sessions are scoped to a project. Each project maintains its own session list with independent filtering, tagging, and review settings.

## Session Types

Sessions have a content type that determines how they are displayed:

| Type | Description | Typical Source |
|------|-------------|---------------|
| Chat | Live chat conversation with back-and-forth messages | Widget, Slack, Intercom |
| Meeting | Call or meeting transcript | Gong |
| Behavioral | User behavior events and actions | API |

The session type is automatically set based on the source channel. Gong sources default to the meeting type; all others default to chat.

## Session Lifecycle

### Active

A new session starts in the **active** status when the first message is received. During this phase, the Hissuno Agent responds to customer messages in real time using the project's knowledge packages.

If the agent cannot resolve the issue, a team member can trigger a **human takeover** to respond directly. Human takeover is supported through the dashboard and through Slack, where the conversation can be forwarded to a specific channel or DM.

### Closing Soon

When the agent detects a goodbye or end-of-conversation signal, the session transitions to **closing_soon**. An idle timer starts, and if no further messages arrive within the configured window, the session closes automatically.

### Awaiting Idle Response

If the customer stops responding mid-conversation, the system sends an idle prompt to check if they still need help. The session enters this status while waiting for a response.

### Closed

Once a session closes (either automatically or manually), it enters the review pipeline. The session review workflow is triggered, which classifies the conversation and decides whether to create or upvote an engineering issue.

Closed sessions remain visible in the dashboard for historical reference and can be filtered and searched.

## Tags and Classification

Sessions are classified with tags that indicate the nature of the feedback. Tags are applied automatically by the **Tagging Agent** during the session review workflow, though they can also be applied or adjusted manually.

### Built-in Tags

| Tag | Applied When |
|-----|-------------|
| General Feedback | Session contains general product feedback, suggestions, or opinions |
| Win | Customer expresses satisfaction, success, gratitude, or positive experience |
| Loss | Customer expresses frustration, failure, confusion, or negative experience |
| Bug | Customer reports something not working as expected |
| Feature Request | Customer asks for new functionality that does not exist |
| Change Request | Customer requests modification to existing functionality |

Sessions can have multiple tags. For example, a session might be tagged as both **Bug** and **Loss** if the customer reported a broken feature and expressed frustration.

### Custom Tags

Projects can define custom tags with their own names, descriptions, and colors. Custom tags are created on the **Agents** page under PM Agent settings and become available for both automatic and manual classification.

When custom tags are defined, the Tagging Agent receives their descriptions as classification guidance. It evaluates each session against both built-in and custom tag criteria.

### Classification Guidelines

You can provide project-level classification guidelines that give the Tagging Agent additional context about how to classify sessions for your specific product. These guidelines are injected into the classification prompt but are treated as guidance, not instructions, to prevent prompt injection.

## Contacts and Companies

Sessions are linked to customer contacts through email matching. When a session is reviewed, the **Resolve Contact** step attempts to match the customer's email from session metadata to an existing contact record. If no match is found and an email is available, a new contact is created automatically.

Contacts can be associated with companies, which track organizational information like domain, ARR, and lifecycle stage. This connection lets you filter and prioritize feedback by account.

## Archiving

Sessions can be archived to remove them from the default list view without deleting them. Archived sessions are still searchable and can be restored at any time.

## Filtering and Search

The session list supports filtering by:

- **Status**: Active, closed, or archived
- **Source**: Widget, Slack, Intercom, Gong, API, or manual
- **Session type**: Chat, meeting, or behavioral
- **Tags**: Any combination of built-in and custom tags
- **Date range**: Filter by creation date or last activity
- **Company**: Filter by the associated company
- **Contact**: Filter by the linked contact
- **Human takeover**: Show only sessions where a human agent intervened
- **Review status**: Show only sessions that have or have not been reviewed by the PM agent

### CLI and API

You can query and search feedback from the CLI or API:

```bash
# List recent feedback from the widget
hissuno list feedback --source widget --limit 20

# Filter by tags
hissuno list feedback --tags bug,feature_request

# Search feedback semantically
hissuno search "users struggling with onboarding" --type feedback

# Get full session details including messages
hissuno get feedback sess_abc123

# Export to JSON for analysis
hissuno --json list feedback --status closed --limit 100 > feedback-export.json
```

## Manual Session Creation

You can create sessions manually from the dashboard or the CLI:

```bash
hissuno add feedback
```

The interactive prompt walks you through adding messages, a session name, and tags. Manual sessions have the source set to **manual** and follow the same review pipeline as automatically captured sessions.

This is useful for logging feedback received through channels that are not directly integrated, such as email threads, conference notes, or verbal conversations.
