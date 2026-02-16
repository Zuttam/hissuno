---
title: "Intercom Integration"
description: "Connect Intercom to Hissuno to import customer conversations and sync feedback in real time."
---

## Overview

The Intercom integration imports customer conversations into Hissuno as feedback sessions. This allows the PM Agent to analyze support interactions at scale, identify recurring themes, and surface product issues that your team might otherwise miss.

Conversations flow from Intercom into Hissuno automatically, giving you a complete picture of what customers are asking about and struggling with.

## Connecting Intercom

### Prerequisites

- An Intercom workspace with admin access
- An Intercom access token with read permissions for conversations and contacts
- An active Hissuno project

### Setup Steps

1. Navigate to **Integrations** in the sidebar and click **Configure** on the Intercom card
2. Enter your Intercom access token in the configuration dialog
3. Select a sync frequency from the dropdown: manual, every 1 hour, every 6 hours, or every 24 hours
4. Optionally set a **From Date** and **To Date** to filter which conversations are imported
5. Click **Save** to activate the integration

### Access Token

You can generate an access token from your Intercom Developer Hub. The token needs read access to conversations and contacts. Hissuno does not use OAuth for Intercom -- you provide the token directly in the configuration dialog.

Hissuno does not write to Intercom or modify any conversations, contacts, or settings.

## Conversation Import

### Initial Import

When you first connect Intercom, Hissuno imports conversations matching your date filters. Use the **From Date** and **To Date** fields in the configuration dialog to control the import window. If no dates are set, Hissuno imports all available conversations.

The initial import runs in the background. You will receive a notification when it completes. Import time depends on conversation volume -- typically 5-15 minutes for most workspaces.

### Sync Modes

Hissuno supports two sync modes for Intercom:

- **Incremental sync** -- Only imports conversations that are new or updated since the last sync. This is the default behavior for scheduled syncs.
- **Full sync ("start from scratch")** -- Re-imports all conversations matching your date filters, replacing previously imported data. Use this if you change your date range or need to correct import issues.

### What Gets Imported

Each Intercom conversation is converted into a Hissuno feedback session containing:

- **Messages** -- The full conversation thread between the customer and your team
- **Customer info** -- Name, email, and company (matched to existing Hissuno customers when possible)
- **Tags** -- Any Intercom tags applied to the conversation
- **Timestamps** -- Original message dates are preserved
- **Conversation state** -- Whether the conversation was resolved, snoozed, or left open

### Filtering Conversations

You can filter which conversations are imported using the **From Date** and **To Date** fields in the Intercom configuration dialog. These date filters control the time window for both the initial import and ongoing syncs. Adjust the date range to focus on the most relevant conversations for your analysis.

### Customer Matching

When importing conversations, Hissuno attempts to match Intercom contacts to existing customers in your project. Matching uses the following fields in order:

1. Email address (exact match)
2. External ID (if configured in both systems)
3. Name + company combination

If no match is found, Hissuno creates a new customer record automatically.

## Scheduled Sync

### How It Works

After the initial import, Hissuno syncs conversations from Intercom on a scheduled basis using the sync frequency you configured (every 1 hour, 6 hours, or 24 hours). You can also set the sync frequency to manual if you prefer to trigger syncs yourself.

At each sync interval, Hissuno:

1. Polls the Intercom API for new or updated conversations within your date range
2. Imports any new conversations as feedback sessions in your project
3. Updates previously imported sessions if conversations have changed
4. Queues new sessions for PM Agent analysis
5. Any identified issues are created or upvoted in your issue tracker

You can also trigger a sync manually at any time from the Intercom integration configuration dialog.

### Deduplication

Hissuno tracks which Intercom conversations have been imported using the conversation ID. If a conversation is reopened and closed again, Hissuno updates the existing session rather than creating a duplicate.

## Troubleshooting

### Conversations Not Importing

If conversations are not appearing in Hissuno after being closed in Intercom:

- Navigate to **Integrations** in the sidebar and verify the Intercom integration is connected
- Check that your date filters are not excluding the conversations
- Confirm the conversation was fully closed (not just snoozed)

### Customer Data Mismatch

If imported conversations are not matching the correct customers:

- Ensure customer email addresses are consistent between Intercom and Hissuno
- Check for duplicate customer records and merge them in the Customers tab

### Disconnecting

To remove the Intercom integration, navigate to **Integrations** in the sidebar, click **Configure** on the Intercom card, and click **Disconnect**. Previously imported sessions remain in Hissuno, but no new conversations will sync.
