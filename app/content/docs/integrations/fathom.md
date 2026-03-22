---
title: "Fathom Integration"
description: "Import AI meeting notes and transcripts from Fathom into Hissuno as feedback sessions."
---

## Overview

The Fathom integration syncs your AI meeting notes and transcripts into Hissuno as feedback sessions with the **meeting** session type. This lets your PM agent analyze customer calls and extract issues, feature requests, and product signals automatically.

## Prerequisites

- A [Fathom](https://fathom.video) account with recorded meetings
- A Fathom API key (generate one at [fathom.video/settings/api](https://fathom.video/settings/api))
- An active Hissuno project

## Connecting Fathom

### From the Dashboard

1. Navigate to **Integrations** in the sidebar
2. Click **Configure** on the Fathom card
3. Enter your Fathom API key
4. Optionally click **Test** to verify the connection
5. Click **Connect Fathom**

### From the CLI

```bash
hissuno integrations add fathom --api-key <your-api-key> --sync-frequency 24h
```

## Self-Hosting

Fathom uses API key authentication - no OAuth configuration or environment variables needed. Just enter your API key in the Hissuno UI or CLI.

## Sync Configuration

After connecting, configure how meetings are synced:

| Setting | Options | Description |
|---------|---------|-------------|
| Sync Frequency | Manual only, Every hour, Every 6 hours, Daily | How often meetings are pulled from Fathom |
| From Date | Date picker | Only sync meetings after this date |
| To Date | Date picker | Only sync meetings before this date |

### Sync Modes

When triggering a manual sync, you can choose:

- **Sync new only** - Import meetings since the last sync (incremental)
- **Sync from start date** - Re-scan all meetings from your configured date range. Already imported sessions are skipped.

First-time syncs always run as a full scan.

## How It Works

When a sync runs:

1. Hissuno fetches meetings from Fathom using your date filters
2. Each meeting is checked against previously synced records to avoid duplicates
3. New meetings are created as feedback sessions with source **Fathom** and type **meeting**
4. The meeting transcript is imported with speaker attribution
5. Sync results (meetings found, synced, skipped) are tracked and visible in the integration settings

## Sync Status

The integration dialog shows:

- **Total Synced** - Number of meetings imported (links to filtered feedback list)
- **Last Sync** - When the last sync ran
- **Last Status** - Success, error, or in progress
- **Last Synced** - How many meetings were imported in the last run

Recent sync runs are tracked with statistics for troubleshooting.

## Disconnecting

To disconnect Fathom:

1. Open the Fathom integration dialog
2. Scroll to **Danger Zone**
3. Click **Disconnect**

Previously synced sessions will remain in your project.
