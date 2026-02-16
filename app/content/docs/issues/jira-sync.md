---
title: "Jira Integration"
description: "Connect Hissuno to Jira for automatic issue syncing and two-way status updates."
---

## Overview

Hissuno integrates with Jira Cloud to keep your engineering backlog in sync with customer feedback. When the integration is enabled, new issues created in Hissuno are automatically pushed to Jira as tickets, and status changes in Jira flow back to Hissuno through webhooks. This eliminates manual ticket creation and ensures your engineering team works from a backlog that reflects real customer demand.

## Setting Up the Integration

### Prerequisites

- A Jira Cloud instance (Server and Data Center are not supported).
- Admin or project admin permissions on the Jira project you want to sync with.
- Owner or Admin role in your Hissuno organization.

### Connecting to Jira

1. Navigate to **Integrations** in the sidebar.
2. Click **Connect to Jira**.
3. You will be redirected to Atlassian's OAuth consent screen. Authorize Hissuno to access your Jira instance.
4. After authorization, you are returned to Hissuno where the connection status shows as active.

The OAuth flow requests read and write access to your Jira projects and issues. Hissuno stores an access token and refresh token securely. Tokens are refreshed automatically before they expire.

> **Note:** Jira integration is currently in Early Access behind a feature flag. Request access from the Integrations page.

### Configuring the Sync Target

After connecting, you need to specify where Hissuno should create tickets:

1. **Select a Jira project** -- Choose the Jira project from the dropdown. Hissuno fetches your available projects from the Jira API.
2. **Select an issue type** -- Choose the default issue type for synced tickets (for example, "Task", "Story", or "Bug"). Hissuno fetches the available issue types for your selected project.
3. Click **Save Configuration**.

The integration is now active. All new issues created in Hissuno will be synced to the configured Jira project.

### Disabling the Integration

You can disable syncing without disconnecting from Jira. Toggle the **Enabled** switch off in the Jira integration settings. Existing synced tickets remain linked, but new issues will not be pushed to Jira until you re-enable the integration.

To fully disconnect, click **Disconnect**. This removes the stored OAuth tokens and webhook registration.

## How Issue Sync Works

### Hissuno to Jira (Automatic)

When the PM Agent creates a new issue (or when you create one manually), Hissuno automatically creates a corresponding Jira ticket if the integration is enabled and configured.

The Jira ticket includes:

- **Summary** -- The issue title from Hissuno.
- **Description** -- The issue description formatted in Atlassian Document Format (ADF), plus a link back to the issue in Hissuno.
- **Issue type** -- The configured default issue type.
- **Labels** -- A `hissuno` label is applied to all synced tickets for easy identification and webhook filtering.

The sync is fire-and-forget: it does not block issue creation. If the Jira API is temporarily unavailable, the sync is recorded as failed and retried automatically.

### Spec Updates

When a product spec is generated for an issue that has already been synced to Jira, Hissuno adds a comment to the Jira ticket with a link to the full spec. This notifies engineers that a detailed specification is available without cluttering the Jira description with the full document.

## Two-Way Status Sync

### Jira to Hissuno (Webhooks)

Hissuno registers a webhook on your Jira instance that listens for issue update events. When a Jira ticket's status changes, the webhook notifies Hissuno and the corresponding issue status is updated automatically.

**Status mapping from Jira to Hissuno:**

| Jira Status | Hissuno Status |
|-------------|----------------|
| In Progress, In Review, In Development | **in_progress** |
| Done, Resolved, Closed | **resolved** |
| Won't Do, Rejected, Declined, Cancelled | **closed** |
| To Do, Open, Backlog | No change (ignored) |

Statuses in the "new" category (To Do, Open, Backlog) are intentionally ignored since they represent Jira's default state and do not carry meaningful information for Hissuno.

### Webhook Security

The webhook is scoped to issues with the `hissuno` label, so only relevant events are processed. Hissuno generates a random secret during webhook registration and uses it to verify incoming payloads via HMAC-SHA256 signature comparison.

## Sync Status and Error Handling

Each synced issue has a sync status visible in the issue detail view:

| Status | Meaning |
|--------|---------|
| **Success** | The issue was synced successfully. The Jira ticket key and link are displayed. |
| **Pending** | A sync operation is queued but has not completed yet. |
| **Failed** | The sync attempt failed. An error message is displayed with details. |

### Automatic Retries

Failed syncs are retried automatically by a background process. The retry system uses incremental retry counts so that persistent failures do not overload the Jira API. You can see the retry count on the sync status display.

### Manual Retry

If an automatic retry has not resolved a sync failure, you can trigger a manual retry from the issue detail view. Click the **Retry Sync** button next to the sync status. Manual retries reset the retry counter and attempt the sync immediately.

## Field Mapping

The current integration maps the following fields:

| Hissuno Field | Jira Field | Direction |
|--------------|------------|-----------|
| Title | Summary | Hissuno to Jira |
| Description | Description (ADF) | Hissuno to Jira |
| Issue type | Issue type (configured default) | Hissuno to Jira |
| -- | Labels (`hissuno`) | Hissuno to Jira |
| Status | Status | Jira to Hissuno |
| Product spec | Comment with link | Hissuno to Jira |

Priority, assignee, and custom Jira fields are not currently synced. Hissuno manages its own priority scoring system based on customer impact data, which does not have a direct equivalent in Jira's priority model.

## Troubleshooting

### Tickets Not Appearing in Jira

- Verify the integration is enabled in **Integrations** in the sidebar.
- Confirm that a Jira project and issue type are selected.
- Check the sync status on the specific issue for error details.
- Ensure your Jira OAuth tokens have not been revoked. If they have, disconnect and reconnect.

### Status Changes Not Syncing Back

- Confirm the webhook is registered by checking the integration settings page.
- Ensure the Jira ticket has the `hissuno` label. The webhook only processes labeled issues.
- Check that the Jira status name matches one of the mapped values in the table above.
