---
title: "HubSpot Integration"
description: "Sync companies and contacts from HubSpot CRM into Hissuno."
---

## Overview

The HubSpot integration syncs companies and contacts from your HubSpot CRM into Hissuno, keeping your customer data in sync. This lets your agents and team see CRM context alongside feedback, issues, and product knowledge.

## Prerequisites

- A HubSpot account with CRM data
- Admin access or a private app with the required scopes
- An active Hissuno project

## Connection Methods

HubSpot supports two connection methods:

### OAuth (recommended)

One-click authorization through HubSpot. Requires OAuth environment variables on self-hosted instances.

1. Navigate to **Integrations** in the sidebar
2. Click **Configure** on the HubSpot card
3. Select the **OAuth** tab
4. Click **Connect with HubSpot**
5. Authorize access in the HubSpot popup

### Private App Token

No server-side configuration needed. Works on any Hissuno instance.

1. Create a [HubSpot private app](https://developers.hubspot.com/docs/api/private-apps) with these scopes:
   - `crm.objects.contacts.read`
   - `crm.objects.companies.read`
2. Navigate to **Integrations** in the sidebar
3. Click **Configure** on the HubSpot card
4. Select the **Private App Token** tab
5. Paste your access token and optionally click **Test**
6. Click **Connect HubSpot**

### From the CLI

```bash
hissuno integrations add hubspot --access-token <token> --sync-frequency 24h --overwrite-policy fill_nulls
```

## Self-Hosting Setup

For **Private App Token** connections, no environment variables are needed.

For **OAuth** connections, create a HubSpot app:

1. Go to your [HubSpot developer account](https://developers.hubspot.com) and create an app
2. Set the **Redirect URL** to:
   ```
   {NEXT_PUBLIC_APP_URL}/api/integrations/hubspot/callback
   ```
3. Under **Scopes**, add: `crm.objects.contacts.read`, `crm.objects.companies.read`
4. Note the **Client ID** and **Client Secret**

```bash
HUBSPOT_CLIENT_ID=your-hubspot-client-id
HUBSPOT_CLIENT_SECRET=your-hubspot-client-secret
```

## Sync Configuration

After connecting, configure how data is synced:

| Setting | Options | Description |
|---------|---------|-------------|
| Sync Frequency | Manual only, Every hour, Every 6 hours, Daily | How often records are pulled from HubSpot |
| Data Merge Policy | Fill empty fields only, HubSpot wins, Never overwrite | How conflicts between HubSpot and Hissuno data are resolved |
| Date Range | From/To date pickers | Restrict which records are synced by modification date |

### Data Merge Policy

| Policy | Behavior |
|--------|----------|
| **Fill empty fields only** | Only populate fields that are currently empty in Hissuno |
| **HubSpot wins** | Overwrite Hissuno fields with HubSpot data on every sync |
| **Never overwrite** | Only create new records, never update existing ones |

### Sync Modes

When triggering a manual sync:

- **Sync new/updated only** - Import records modified since the last sync (incremental)
- **Full sync** - Re-scan all records from the configured date range. Existing records are updated per the merge policy.

## How It Works

When a sync runs:

1. Hissuno fetches companies and contacts from HubSpot using the configured filters
2. Records are matched against existing Hissuno companies and contacts
3. New records are created, existing records are updated per the merge policy
4. Sync results (companies synced, contacts synced) are tracked

## Sync Status

The integration dialog shows:

- **Connection** - Hub name and auth method (OAuth or Private App Token)
- **Companies Synced / Contacts Synced** - Totals with links to the respective lists
- **Last Sync / Status** - When the last sync ran and its result

## Disconnecting

To disconnect HubSpot:

1. Open the HubSpot integration dialog
2. Scroll to **Danger Zone**
3. Click **Disconnect**

Previously synced companies and contacts will remain.
