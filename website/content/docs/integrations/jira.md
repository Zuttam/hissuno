---
title: "Jira Integration"
description: "Connect Jira to Hissuno to sync product issues and keep your engineering backlog aligned with customer feedback."
---

## Overview

The Jira integration enables two-way synchronization between Hissuno issues and your Jira project. When the PM Agent identifies a product issue from customer feedback, it can automatically create a corresponding Jira ticket. As the Jira ticket progresses through your workflow, its status is reflected back in Hissuno.

This keeps your engineering backlog grounded in real customer needs and gives your product team visibility into what has been shipped versus what customers are still asking for.

> **Early Access:** The Jira integration is currently in Early Access behind a feature flag. Request access from the Integrations page.

## Self-Hosting Setup

If you are self-hosting Hissuno, you need to create your own Atlassian OAuth app before using this integration. See the [Self-Hosting Integration Setup](/docs/integrations/self-hosting-setup#jira) guide for step-by-step instructions on creating an OAuth app and configuring the required environment variables.

## Connecting Jira

### Prerequisites

- A Jira Cloud instance (Server and Data Center are not supported)
- Jira project admin permissions
- An active Hissuno project

### Setup Steps

1. Navigate to **Integrations** in the sidebar and click **Configure** on the Jira card
2. Click **Connect Jira**
3. You will be redirected to Atlassian to authorize Hissuno
4. Select the Jira site to connect
5. Grant the requested permissions and confirm
6. Back in Hissuno, select which Jira project to link

### Permissions

Hissuno requests the following Jira API scopes:

| Scope | Purpose |
|-------|---------|
| Read projects | List available projects for linking |
| Read issues | Sync issue status and details |
| Write issues | Create issues from Hissuno |
| Read webhooks | Receive status change events |
| Write webhooks | Register webhook for real-time sync |

## Issue Sync Configuration

### Issue Sync Setup

After connecting Jira, select which Jira project to link and choose the default issue type for new tickets. These are the primary configuration options for the integration.

When the PM Agent creates a new issue in Hissuno, you can send it to Jira using the "Send to Jira" button on the issue detail page. The issue title, description, and feedback context are included in the Jira ticket.

## Status Mapping

### Configuring Status Sync

Jira workflows vary between projects. Hissuno needs to understand how your Jira statuses correspond to its own issue lifecycle.

Navigate to **Integrations** in the sidebar, click **Configure** on the Jira card, and go to the **Status Mapping** section.

Map your Jira statuses to Hissuno issue states:

| Hissuno State | Example Jira Statuses |
|---------------|----------------------|
| Open | To Do, Backlog, Open |
| In Progress | In Progress, In Development, In Review |
| Done | Done, Closed, Released |
| Won't Fix | Won't Do, Declined, Duplicate |

### How Status Sync Works

Status changes flow in both directions:

**Jira to Hissuno** -- When a Jira ticket transitions to a new status, Hissuno receives a webhook event and updates the corresponding Hissuno issue state based on your status mapping.

**Hissuno to Jira** -- When you change an issue's state in Hissuno, the linked Jira ticket is transitioned to the first mapped status in the target state. For example, marking an issue as "Done" in Hissuno transitions the Jira ticket to your first "Done" mapped status.

### Conflict Resolution

If the same issue is updated in both systems simultaneously, the most recent change wins. Hissuno logs all sync events so you can review the history:

You can review sync history from the Jira integration configuration dialog.

## Jira Ticket Content

When Hissuno creates a Jira ticket, the description includes:

- A summary written by the PM Agent based on aggregated customer feedback
- The number of customers who reported the issue
- Links to the relevant feedback sessions in Hissuno
- A generated spec (if the issue has reached the spec generation threshold)
- Tags and priority rationale

This gives engineers full context about the customer need without having to leave Jira.

## Troubleshooting

### Issues Not Syncing

If Hissuno issues are not appearing in Jira:

- Navigate to **Integrations** in the sidebar and verify the Jira integration is connected
- Check the auto-create setting and ensure it matches your expectation
- Confirm the linked Jira project still exists and has not been archived

### Status Not Updating

If status changes in Jira are not reflected in Hissuno:

- Review your status mapping to ensure all active Jira statuses are mapped
- Check the sync log for webhook delivery errors
- Verify that the Hissuno webhook is registered in your Jira project settings

### Disconnecting

To remove the Jira integration, navigate to **Integrations** in the sidebar, click **Configure** on the Jira card, and click **Disconnect**. Existing Jira tickets are not deleted, but the link between Hissuno issues and Jira tickets is removed. Future status changes will not sync.
