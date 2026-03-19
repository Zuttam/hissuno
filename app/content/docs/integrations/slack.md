---
title: "Slack Integration"
description: "Install the Hissuno Slack bot to collect customer feedback from channels and receive real-time notifications."
---

## Overview

The Slack integration connects Hissuno to your workspace so your team can collect customer feedback directly from Slack channels, receive notifications about new issues and trends, and interact with Hissuno's AI agents without leaving Slack.

## Self-Hosting Setup

If you are self-hosting Hissuno, you need to create your own Slack app before using this integration. See the [Self-Hosting Integration Setup](/docs/integrations/self-hosting-setup#slack) guide for step-by-step instructions on creating a Slack app and configuring the required environment variables.

## Installing the Slack Bot

### Prerequisites

- Slack workspace admin permissions (or approval from an admin)
- An active Hissuno project

### Installation Steps

1. Navigate to **Integrations** in the sidebar and click **Configure** on the Slack card
2. Click **Add to Slack**
3. Review the requested permissions and authorize the Hissuno bot
4. Select which Slack channels the bot should join
5. Click **Allow** to complete the installation

After installation, the Hissuno bot will appear in your Slack workspace and join the selected channels.

### Bot Permissions

The Hissuno Slack bot requests the following OAuth scopes:

| Scope | Purpose |
|-------|---------|
| `channels:read` | List public channels for selection |
| `channels:history` | Read messages in connected channels |
| `chat:write` | Send notifications and responses |
| `reactions:read` | Detect feedback reactions |
| `users:read` | Identify who submitted feedback |
| `commands` | Handle slash commands |

Hissuno only reads messages in channels you explicitly connect. It does not access direct messages or private channels unless invited.

## Channel-Based Feedback Collection

### Connecting Channels

After installing the bot, configure which channels Hissuno monitors for customer feedback:

Navigate to **Integrations** in the sidebar, click **Configure** on the Slack card, and go to the **Managed Channels** section.

Click **Add Channel** and select from your workspace's public channels. You can also invite the Hissuno bot to a private channel to monitor it.

### How Feedback Is Collected

Hissuno collects feedback from connected channels in two ways:

**Reaction-based collection** -- Add a specific emoji reaction (default: `:hissuno:`) to any message to send it to Hissuno as customer feedback. This is useful when your team spots relevant feedback in general discussion.

**Slash command** -- Use the `/hissuno` command to submit feedback directly:

```
/hissuno feedback Customer is requesting bulk export for CSV data
```

**Thread capture** -- When a message is flagged, Hissuno captures the entire thread for full context, not just the individual message.

### Feedback Processing

Once feedback enters Hissuno, it follows the standard processing pipeline:

1. A new feedback session is created in your project
2. The PM Agent analyzes the feedback content
3. If the feedback matches an existing issue, the issue is upvoted
4. If it represents a new concern, a new issue is created
5. Your team is notified based on your notification preferences

## Notification Settings

### Configuring Notifications

Hissuno can send notifications to designated Slack channels when key events occur. Configure these in:

Navigate to **Integrations** in the sidebar, click **Configure** on the Slack card, and go to the **Notifications** section.

### Available Notification Types

| Event | Description | Default |
|-------|-------------|---------|
| New issue created | A new product issue was identified from feedback | On |
| Issue threshold reached | An issue received enough upvotes to trigger spec generation | On |
| Feedback received | New feedback was submitted through any channel | Off |
| Agent escalation | The Hissuno Agent escalated a conversation to a human | On |
| Weekly digest | Summary of feedback trends and top issues | On |

### Notification Channel

You can route different notification types to different channels. For example, send escalations to `#support-escalations` and new issues to `#product-feedback`.

Configure channel routing within the Notifications section of the Slack integration configuration.

### Mention Settings

Configure whether notifications should mention specific users or groups:

- **No mention** -- Post the notification silently
- **Mention channel** -- Use `@channel` for urgent notifications
- **Mention specific users** -- Tag assigned team members

## Slash Commands

The Hissuno bot supports the following slash commands:

| Command | Description |
|---------|-------------|
| `/hissuno feedback <text>` | Submit feedback directly |
| `/hissuno status` | Check integration status |
| `/hissuno issues` | List top open issues for your project |
| `/hissuno help` | Show available commands |

## Troubleshooting

### Bot Not Responding

If the Hissuno bot is not responding to reactions or commands:

- Verify the bot is a member of the channel (`/invite @Hissuno`)
- Check that the channel is listed in your managed channels
- Re-authorize the integration if permissions were recently changed

### Missing Notifications

If notifications are not appearing:

- Confirm the notification type is enabled in settings
- Verify the bot has `chat:write` permission in the target channel
- Check that the notification channel still exists and the bot is a member

### Removing the Integration

To disconnect Slack, navigate to **Integrations** in the sidebar, click **Configure** on the Slack card, and click **Disconnect**. Then remove the Hissuno app from your Slack workspace under **Slack Settings > Manage Apps**.
