---
title: "Linear Integration"
description: "Connect Linear to Hissuno to sync product issues and keep your engineering backlog aligned with customer feedback."
---

## Overview

The Linear integration enables two-way synchronization between Hissuno issues and your Linear workspace. When the PM Agent identifies a product issue from customer feedback, it can automatically create a corresponding Linear issue. As the Linear issue progresses through your workflow, its status is reflected back in Hissuno.

This keeps your engineering backlog grounded in real customer needs and gives your product team visibility into what has been shipped versus what customers are still asking for.

## Self-Hosting Setup

If you are self-hosting Hissuno, you need to create your own Linear OAuth app before using this integration. See the [Self-Hosting Integration Setup](/docs/integrations/self-hosting-setup#linear) guide for step-by-step instructions on creating an OAuth app and configuring the required environment variables.

## Connecting Linear

### Prerequisites

- A Linear workspace with admin access
- An active Hissuno project

### Setup Steps

1. Navigate to **Integrations** in the sidebar and click **Configure** on the Linear card
2. Click **Connect Linear**
3. You will be redirected to Linear to authorize Hissuno
4. Grant the requested permissions and confirm
5. Back in Hissuno, select which Linear team to link
6. Choose whether to enable auto-sync

### Permissions

Hissuno requests the following Linear OAuth scopes:

| Scope | Purpose |
|-------|---------|
| Read issues | Sync issue status and details |
| Write issues | Create issues from Hissuno |
| Read teams | List available teams for linking |

## Configuration

### Team Selection

After connecting Linear, select which team new issues should be created in. The team selector shows all teams in your Linear workspace with their key prefix (e.g., "ENG - Engineering").

You can change the linked team at any time from the Linear integration configuration dialog by clicking **Change Team**.

### Auto-Sync

When auto-sync is enabled, new issues created by the PM Agent in Hissuno are automatically synced to the selected Linear team. You can toggle auto-sync on or off from the configuration dialog.

When auto-sync is disabled, you can still send individual issues to Linear using the **Send to Linear** button on the issue detail page.

## How Sync Works

### Hissuno to Linear

When the PM Agent creates a new issue in Hissuno:

- **Auto-sync enabled** -- The issue is automatically created in Linear under the configured team
- **Auto-sync disabled** -- Use the "Send to Linear" button on the issue detail page to sync manually

The Linear issue includes the title, description, and feedback context from Hissuno, giving engineers full context about the customer need.

### Linear to Hissuno

Status changes on Linear issues are synced back to Hissuno. When a Linear issue is completed, closed, or cancelled, the corresponding Hissuno issue state is updated automatically.

## Linear Issue Content

When Hissuno creates a Linear issue, the description includes:

- A summary written by the PM Agent based on aggregated customer feedback
- The number of customers who reported the issue
- Links to the relevant feedback sessions in Hissuno
- A generated spec (if the issue has reached the spec generation threshold)
- Tags and priority rationale

This gives engineers full context about the customer need without having to leave Linear.

## Troubleshooting

### Issues Not Syncing

If Hissuno issues are not appearing in Linear:

- Navigate to **Integrations** in the sidebar and verify the Linear integration is connected
- Check the auto-sync setting and ensure it is enabled (or use the manual "Send to Linear" button)
- Confirm the linked Linear team still exists and has not been archived

### Team Not Loading

If teams are not appearing in the team selector:

- Verify your Linear account has access to at least one team
- Try disconnecting and reconnecting the integration

### Disconnecting

To remove the Linear integration, navigate to **Integrations** in the sidebar, click **Configure** on the Linear card, and click **Disconnect**. Previously synced issues will remain in Linear, but the link between Hissuno issues and Linear issues is removed. Future status changes will not sync.
