---
title: "Notion Integration"
description: "Import Notion pages as knowledge sources for your Hissuno project."
---

## Overview

The Notion integration connects your Notion workspace to Hissuno, letting you import pages as knowledge sources. Your documentation, wikis, and internal notes become part of the knowledge graph - searchable by agents and queryable through CLI and API.

## Prerequisites

- A Notion workspace with pages you want to import
- Workspace admin access (for OAuth) or the ability to create internal integrations
- An active Hissuno project

## Connection Methods

Notion supports two connection methods:

### OAuth (recommended)

One-click authorization through Notion. Requires OAuth environment variables on self-hosted instances.

1. Navigate to **Integrations** in the sidebar
2. Click **Configure** on the Notion card
3. Select the **OAuth** tab
4. Click **Connect with Notion**
5. Select which pages to share and authorize access

### Integration Token

No server-side configuration needed. Works on any Hissuno instance.

1. Go to [notion.so/profile/integrations](https://www.notion.so/profile/integrations) and create an internal integration
2. Copy the **Internal Integration Token** (starts with `ntn_` or `secret_`)
3. In Notion, share the pages you want to import with your integration
4. Navigate to **Integrations** in the sidebar
5. Click **Configure** on the Notion card
6. Select the **Integration Token** tab
7. Paste your token and click **Connect**

### From the CLI

```bash
hissuno integrations add notion --access-token <token>
```

## Self-Hosting Setup

For **Integration Token** connections, no environment variables are needed.

For **OAuth** connections, create a Notion integration:

1. Go to [notion.so/profile/integrations](https://www.notion.so/profile/integrations) and create a **Public integration**
2. Set the **Redirect URI** to:
   ```
   {NEXT_PUBLIC_APP_URL}/api/integrations/notion/callback
   ```
3. Note the **OAuth client ID** and **OAuth client secret**

```bash
NOTION_CLIENT_ID=your-notion-client-id
NOTION_CLIENT_SECRET=your-notion-client-secret
```

## Importing Pages

After connecting Notion, import pages as knowledge sources:

1. Go to **Configuration** in the sidebar
2. Under knowledge sources, click **Add Knowledge** and select **Notion**
3. Browse your workspace and select pages to import
4. Selected pages are added as knowledge sources and analyzed

Imported pages become part of Hissuno's knowledge packages (business, product, or technical) and are available for semantic search and agent queries.

## How It Works

When you import a Notion page:

1. The page content is fetched through the Notion API
2. Content is converted to a format suitable for analysis
3. The knowledge analysis workflow processes the page
4. The page is embedded for semantic search
5. It becomes available through CLI and API queries

## Keeping Pages Updated

Notion pages are imported at a point in time. To refresh a page with updated content, re-import it from the Configuration page. The existing knowledge source will be updated with the latest content.

## Disconnecting

To disconnect Notion:

1. Open the Notion integration dialog
2. Scroll to **Danger Zone**
3. Click **Disconnect**

Previously imported pages will remain as knowledge sources in your project.
