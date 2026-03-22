---
title: "PostHog Integration"
description: "Enrich Hissuno contacts with behavioral profiles from PostHog product analytics."
---

## Overview

The PostHog integration syncs user profiles and event data from PostHog into Hissuno, enriching your contacts with behavioral analytics. This gives your agents and team visibility into how customers actually use your product alongside their feedback.

## Prerequisites

- A [PostHog](https://posthog.com) account with event data
- A PostHog Personal API Key (create one at Settings > Personal API Keys)
- Your PostHog Project ID (found in your project settings URL)
- An active Hissuno project

## Connecting PostHog

### From the Dashboard

1. Navigate to **Integrations** in the sidebar
2. Click **Configure** on the PostHog card
3. Enter your API Key, Host URL, and PostHog Project ID
4. Click **Test & Connect**

### Host URL

- **PostHog Cloud US**: `https://app.posthog.com` (default)
- **PostHog Cloud EU**: `https://eu.posthog.com`
- **Self-hosted**: Your PostHog instance URL

## Self-Hosting

PostHog uses API key authentication - no OAuth configuration or environment variables needed. Just enter your credentials in the Hissuno UI.

## Sync Configuration

After connecting, configure how profiles are synced:

| Setting | Options | Description |
|---------|---------|-------------|
| Sync Frequency | Manual only, Every hour, Every 6 hours, Daily | How often profiles are pulled from PostHog |
| Date Range | From/To date pickers | Only sync events within this range (default: last 30 days) |
| Create New Contacts | Checkbox | When enabled, PostHog persons without a matching Hissuno contact are created as new contacts |

### Create New Contacts

When this option is enabled, PostHog persons that don't match an existing contact in Hissuno will be created as new contacts with behavioral profiles and activity sessions. When disabled, only existing contacts are enriched.

## How It Works

When a sync runs:

1. Hissuno queries PostHog for persons and their event data
2. Each person is matched against existing Hissuno contacts by email or distinct ID
3. Matching contacts are enriched with behavioral profile data
4. If "Create New Contacts" is enabled, unmatched persons become new contacts
5. Sync results (profiles synced, contacts created) are tracked

## Sync Status

The integration dialog shows:

- **Host** - Your PostHog instance URL
- **Project ID** - The connected PostHog project
- **Total Synced** - Number of profiles imported (links to contacts list)
- **Last Sync / Status** - When the last sync ran and its result
- **Contacts Created** - How many new contacts were created in the last run

## Disconnecting

To disconnect PostHog:

1. Open the PostHog integration dialog
2. Scroll to **Danger Zone**
3. Click **Disconnect**

Previously synced contacts and their enrichment data will remain.
