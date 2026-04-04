---
title: "Zendesk Integration"
description: "Connect Zendesk to Hissuno to import solved tickets and sync customer feedback automatically."
---

## Overview

The Zendesk integration imports solved and closed tickets from your Zendesk account into Hissuno as feedback sessions. This allows the PM Agent to analyze support interactions at scale, identify recurring themes, and surface product issues that your team might otherwise miss.

Tickets flow from Zendesk into Hissuno on a configurable schedule, giving you a complete picture of what customers are asking about and struggling with.

## Connecting Zendesk

### Prerequisites

- A Zendesk account with admin access
- A Zendesk API token
- An active Hissuno project

### Setup Steps

1. Navigate to **Integrations** in the sidebar and click **Configure** on the Zendesk card
2. Enter your Zendesk **subdomain** (e.g., `mycompany` for mycompany.zendesk.com)
3. Enter the **admin email** associated with your Zendesk account
4. Enter your **API token**
5. Click **Test** to verify the credentials are valid
6. Select a **sync frequency**: manual only, every hour, every 6 hours, or daily
7. Optionally set a **From Date** and **To Date** to filter which tickets are imported
8. Click **Connect Zendesk** to activate the integration

### API Token

Generate an API token in Zendesk under **Admin > Apps and integrations > Zendesk API**. The token is used with your admin email for authentication. Hissuno does not use OAuth for Zendesk -- you provide the token directly in the configuration dialog.

Hissuno only reads tickets from Zendesk. It does not modify any tickets, users, or settings.

## Ticket Import

### Initial Import

When you first connect Zendesk, Hissuno imports solved and closed tickets matching your date filters. Use the **From Date** and **To Date** fields to control the import window. If no dates are set, Hissuno imports all available solved/closed tickets.

The initial import runs in the background with a progress indicator. Import time depends on ticket volume.

### Sync Modes

Hissuno supports two sync modes for Zendesk:

- **Incremental sync ("Sync new only")** -- Only imports tickets that are new or updated since the last sync. This is the default behavior for scheduled syncs.
- **Full sync ("Sync from start date")** -- Re-scans all tickets from your configured date range. Tickets that have already been imported are skipped automatically, so no duplicates are created.

You can choose between these modes when triggering a manual sync from the configuration dialog.

### What Gets Imported

Each solved or closed Zendesk ticket is converted into a Hissuno feedback session containing:

- **Messages** -- The full ticket conversation thread between the customer and your team
- **Customer info** -- Name, email, and company (matched to existing Hissuno customers when possible)
- **Timestamps** -- Original message dates are preserved
- **Ticket metadata** -- Ticket ID and status

### Customer Matching

When importing tickets, Hissuno attempts to match Zendesk requesters to existing customers in your project. Matching uses email address. If no match is found, Hissuno creates a new customer record automatically.

## Scheduled Sync

### How It Works

After the initial import, Hissuno syncs tickets from Zendesk on a scheduled basis using the sync frequency you configured (every hour, every 6 hours, or daily). You can also set the sync frequency to manual if you prefer to trigger syncs yourself.

At each sync interval, Hissuno:

1. Polls the Zendesk API for solved/closed tickets within your date range
2. Imports any new tickets as feedback sessions in your project
3. Skips tickets that have already been imported
4. Queues new sessions for PM Agent analysis
5. Any identified issues are created or upvoted in your issue tracker

You can also trigger a sync manually at any time from the Zendesk integration configuration dialog using the **Sync Now** button.

### Deduplication

Hissuno tracks which Zendesk tickets have been imported using the ticket ID. If a ticket has already been synced, it is skipped during subsequent syncs to avoid creating duplicates.

## Troubleshooting

### Tickets Not Importing

If tickets are not appearing in Hissuno after syncing:

- Navigate to **Integrations** in the sidebar and verify the Zendesk integration is connected
- Check that your date filters are not excluding the tickets you expect
- Confirm the tickets are in a solved or closed state (open or pending tickets are not imported)
- Review the sync status in the configuration dialog for any error messages

### Credential Issues

If the connection test fails:

- Verify your subdomain is correct (just the subdomain, not the full URL)
- Confirm the admin email matches the account that generated the API token
- Ensure the API token has not been revoked in Zendesk Admin

### Disconnecting

To remove the Zendesk integration, navigate to **Integrations** in the sidebar, click **Configure** on the Zendesk card, and click **Disconnect**. Previously imported sessions remain in Hissuno, but no new tickets will sync.
