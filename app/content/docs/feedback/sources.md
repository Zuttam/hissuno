---
title: "Feedback Sources"
description: "Connect the channels where your customers communicate to automatically capture feedback sessions."
---

## Overview

Hissuno captures customer feedback from multiple channels and consolidates it into a single session list. Each source integration creates sessions automatically when conversations occur, so your team does not need to manually log feedback.

Supported source channels are: Widget, Slack, Intercom, Gong, API, and manual entry.

## Widget

The Hissuno widget is an embeddable chat component that you add to your website or application. It provides a direct channel for customers to interact with your AI support agent.

### How It Works

1. Install the `@hissuno/widget` npm package or embed the script tag in your site
2. Configure the widget with your project ID
3. Customers open the chat and send messages
4. The AI support agent responds in real time using your project's knowledge packages
5. Each conversation is captured as a feedback session with the source set to **Widget**

Sessions are created when a customer sends their first message. The widget passes metadata including the page URL, page title, and any custom user metadata you provide (name, email, user ID). Features include real-time streaming responses, session continuity across page navigations, automatic idle closing, and human takeover from the dashboard.

## Slack

The Slack integration connects your workspace so that customer conversations happening in Slack channels are captured as feedback sessions.

### Setup

1. Navigate to **Integrations** in the sidebar
2. Click **Connect to Slack** to begin the OAuth flow
3. Authorize the Hissuno app in your Slack workspace
4. Select which channels to monitor

### Channel Modes

Each connected channel operates in one of two modes:

| Mode | Behavior |
|------|----------|
| Interactive | The AI agent actively responds to messages in the channel. Each thread becomes a session where the bot participates in the conversation. |
| Passive | Messages are captured as sessions for review, but the AI agent does not respond. This mode is for monitoring channels where you want to collect feedback without bot interference. |

### Capture Scope

For each channel, you can configure the capture scope:

- **External only**: Only capture threads that involve external participants (customers, partners). Internal team discussions are ignored.
- **All**: Capture all threads in the channel regardless of participants.

### Thread Mapping and Human Takeover

Each Slack thread maps to one feedback session. Messages within the thread are recorded with the correct sender type. When a human agent responds in an interactive thread, the system tracks the handoff for analytics. Team members can also take over a session from the dashboard and respond via Slack DM forwarding.

## Intercom

The Intercom integration syncs your Intercom conversations into Hissuno as feedback sessions.

### Setup

1. Navigate to **Integrations** in the sidebar
2. Enter your Intercom access token
3. Configure sync settings including frequency and date filters
4. Click **Connect** to validate credentials and save

### Sync Configuration

| Setting | Options | Description |
|---------|---------|-------------|
| Sync Frequency | Manual, Every 1h, Every 6h, Every 24h | How often conversations are pulled from Intercom |
| Date Filter | From date, To date | Restrict which conversations are synced based on their creation date |

### How Sync Works

When a sync runs (manually or on schedule), Hissuno:

1. Fetches conversations from Intercom using the configured filters
2. Checks each conversation against the sync history to avoid duplicates
3. Creates a new feedback session for each unseen conversation
4. Records the conversation parts as session messages
5. Updates the sync state with the result (success/error, count)

Each sync run is tracked with statistics: conversations found, synced, and skipped. You can view the last five sync runs in the integration settings.

### Sync Modes

- **Incremental**: Only new conversations since the last sync are processed (default behavior)
- **Start from scratch**: Clears sync history and re-imports all matching conversations

## Gong

The Gong integration imports call recordings and transcripts as feedback sessions with the **meeting** session type.

### Setup

1. Navigate to **Integrations** in the sidebar
2. Enter your Gong API credentials: base URL, access key, and access key secret
3. Set sync frequency and optional date filters
4. Click **Connect** to test and save

### Sync Configuration

| Setting | Options | Description |
|---------|---------|-------------|
| Sync Frequency | Manual, Every 1h, Every 6h, Every 24h | How often calls are pulled from Gong |
| Date Filter | From date, To date | Restrict which calls are synced based on their date |

### How Sync Works

Gong syncs follow the same pattern as Intercom:

1. Fetch calls from the Gong API with configured filters
2. Deduplicate against previously synced calls
3. Create feedback sessions with the **meeting** type for new calls
4. Import the call transcript as session messages
5. Track sync results including call count and duration

### Meeting Transcripts

Gong transcripts are stored as session messages with speaker attribution. The session type is automatically set to **meeting**, which changes how the conversation is rendered in the dashboard (transcript view instead of chat bubbles).

## API

For channels not covered by the built-in integrations, you can use the Hissuno API to create sessions programmatically.

Send a POST request with `project_id`, `source` (set to `"api"`), `messages`, and optional `user_metadata` and `tags`. API-created sessions follow the same review pipeline as sessions from other sources.

Common use cases include importing feedback from email threads, connecting custom chat platforms, logging in-person conversations, and integrating with internal tools that capture customer sentiment.

## Manual Entry

Sessions can be created manually from the dashboard by clicking **New Session** in the feedback list. Manual sessions support custom names, pre-applied tags, and multiple messages with role attribution. They follow the same review pipeline as any other source.

## Source Badges

Each session displays a source badge in the feedback list: **Widget**, **Slack**, **Intercom**, **Gong**, **API**, or **Manual**. This helps your team quickly identify the originating channel and prioritize accordingly.
