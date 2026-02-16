---
title: "Connecting Sources"
description: "Connect feedback sources like Intercom, Slack, and Gong to automatically collect customer conversations."
---

## How Sources Work

Hissuno collects customer conversations from external tools and converts them into feedback sessions. Each feedback session is analyzed by the AI to extract insights, assign tags, and create or upvote issues. Connecting a source is the primary way to get data flowing into your project.

## Supported Integrations

| Source | Type | Description |
|--------|------|-------------|
| **Intercom** | Live chat / tickets | Imports conversations from your Intercom workspace. |
| **Slack** | Messaging | Monitors designated Slack channels for customer feedback threads. |
| **Gong** | Call recordings | Ingests call transcripts and surfaces product feedback from sales and support calls. (Early Access) |
| **Jira** | Issue tracking | Syncs Jira issues and comments as feedback. (Early Access) |
| **Widget** | Embedded chat | Collects conversations from the Hissuno widget embedded in your product. See [Embedding the Widget](/docs/getting-started/embedding-widget). |
| **CSV Import** | Manual upload | Upload historical feedback data in bulk. |

## Connecting Intercom

1. Navigate to **Integrations** in the sidebar.
2. Click **Connect** next to the Intercom integration.
3. Enter your Intercom access token. You can generate one from your Intercom Developer Hub under **Authentication**.
4. Click **Save**.

Hissuno will begin importing recent conversations. New conversations are synced automatically going forward.

### Filtering Intercom Conversations

You can limit which conversations are imported by configuring date filters:

- **From date** -- Only import conversations created on or after this date, useful for avoiding very old conversations during initial setup.
- **To date** -- Only import conversations created on or before this date.

## Connecting Slack

1. Navigate to **Integrations** in the sidebar.
2. Click **Connect** next to the Slack integration.
3. Authorize the Hissuno Slack app in your workspace.
4. Select one or more channels to monitor. These should be channels where customers or internal teams share product feedback (e.g., `#customer-feedback`, `#support-escalations`).
5. Click **Save**.

### How Slack Messages Become Feedback

Hissuno monitors the selected channels and groups related messages into feedback sessions. A new session is created when:

- A thread is started in a monitored channel.
- A message is posted that the AI identifies as containing product feedback.

Short messages like greetings or emoji reactions are filtered out automatically.

## Connecting Gong

> **Note:** Gong integration is currently in **Early Access** behind a feature flag. On the Integrations page, you will see an "Early Access" badge and a **Request Access** button. Contact the Hissuno team to enable it for your project.

1. Navigate to **Integrations** in the sidebar.
2. Click **Request Access** on the Gong integration card (or **Connect** if already enabled).
3. Enter your Gong API credentials (access key and secret). You can generate these from **Gong > Company Settings > API**.
4. Choose whether to import all calls or only calls matching specific filters (e.g., calls tagged with "product feedback" or calls involving certain teams).
5. Click **Save**.

Gong transcripts are processed asynchronously. Depending on volume, the initial import may take several minutes. Each call becomes a feedback session with the full transcript available in the detail view.

## Importing CSV Data

For historical data or sources without a direct integration, you can upload feedback via CSV.

1. Go to **Customers** in the sidebar and click **Import**.
2. Upload a CSV file with your customer and feedback data.
3. Map the CSV columns to Hissuno fields during the import wizard.
4. Click **Import** to process the file.

### CSV Format Guidelines

Your CSV should include at minimum:

- A customer identifier column (email or name).
- A feedback content column containing the conversation or comment text.

Optional columns include timestamp, tags, and additional customer metadata. The import wizard lets you map columns flexibly, so exact column names do not matter.

## Managing Connected Sources

After connecting a source, you can manage it from **Integrations** in the sidebar:

- **Pause syncing** -- Temporarily stop importing new conversations without disconnecting the source.
- **Reconfigure filters** -- Adjust which conversations are imported.
- **Disconnect** -- Remove the integration entirely. Previously imported feedback sessions are retained.
- **View sync status** -- Check when the last sync occurred and whether any errors were encountered.

## How Feedback Sessions Are Created

When a new conversation arrives from any connected source, Hissuno processes it through several steps:

1. **Ingestion** -- The raw conversation is stored and associated with a customer profile.
2. **Tagging** -- The AI tagging agent classifies the session (e.g., `bug`, `feature_request`, `change_request`).
3. **PM Review** -- The product manager agent analyzes the session and either creates a new issue or upvotes an existing one if the feedback matches a known topic.
4. **Notification** -- If the feedback triggers a new issue or crosses a vote threshold, relevant team members are notified.

This pipeline runs automatically for every connected source with no manual intervention required.

## Next Steps

With sources connected, your feedback pipeline is active. Continue to [Embedding the Widget](/docs/getting-started/embedding-widget) to add a customer-facing support chat directly in your product.
