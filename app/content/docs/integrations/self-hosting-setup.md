---
title: "Self-Hosting Integration Setup"
description: "How to configure OAuth integrations for your self-hosted Hissuno instance."
---

## Overview

Hissuno integrations that use OAuth require you to create your own app/credentials with each provider. This guide walks through creating the required OAuth apps for each integration.

**API-key integrations** (Gong, Zendesk, PostHog) work without any server-side configuration - just enter your API key in the Hissuno UI.

**Widget** works out of the box with no external app or credentials needed.

All environment variables referenced below are documented in `env.example` at the root of the Hissuno repository.

## Callback URL Pattern

All OAuth callbacks follow the same pattern:

```
{NEXT_PUBLIC_APP_URL}/api/integrations/{provider}/callback
```

Replace `{NEXT_PUBLIC_APP_URL}` with your instance URL (e.g. `https://hissuno.yourcompany.com`).

---

## Slack

### Creating a Slack App

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps) and click **Create New App** > **From scratch**
2. Name the app (e.g. "Hissuno") and select your workspace
3. Navigate to **OAuth & Permissions** and add the following Bot Token Scopes:
   - `app_mentions:read`, `channels:history`, `channels:join`, `channels:read`
   - `chat:write`, `groups:history`, `groups:read`, `reactions:write`
   - `users:read`, `users:read.email`
4. Under **OAuth & Permissions** > **Redirect URLs**, add:
   ```
   {NEXT_PUBLIC_APP_URL}/api/integrations/slack/callback
   ```
5. Navigate to **Event Subscriptions** > Enable Events, and set the Request URL to:
   ```
   {NEXT_PUBLIC_APP_URL}/api/integrations/slack/events
   ```
   Subscribe to bot events: `app_mention`, `message.channels`, `message.groups`
6. Go to **Basic Information** and copy the **Client ID**, **Client Secret**, and **Signing Secret**

### Environment Variables

```bash
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
SLACK_SIGNING_SECRET=your-slack-signing-secret
```

---

## GitHub

Hissuno supports two ways to connect GitHub. Choose the one that fits your setup.

### Option A: Personal Access Token (recommended for self-hosted)

The simplest way to connect. No environment variables or GitHub App creation needed.

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens) and create a new token
   - **Classic token:** select the `repo` scope
   - **Fine-grained token:** grant "Contents" read access on the repositories you want
2. In Hissuno, open the GitHub integration dialog for your project
3. Select **Access Token**, paste your token, and click **Connect**

That's it - no server-side configuration required.

### Option B: GitHub App (advanced)

Use this if you prefer OAuth-based auth or need organization-wide installations.

1. Go to [https://github.com/settings/apps](https://github.com/settings/apps) and click **New GitHub App**
2. Set **Homepage URL** to your Hissuno instance URL
3. Set **Callback URL** to:
   ```
   {NEXT_PUBLIC_APP_URL}/api/integrations/github/callback
   ```
4. Optionally set **Setup URL** to the same callback URL
5. Set **Webhook URL** to your Hissuno instance URL + `/api/webhooks/github` (if using webhook-based sync)
6. Under **Permissions**, grant:
   - Repository contents: **Read**
   - Metadata: **Read**
   - Pull requests: **Read**
   - Webhooks: **Read & Write**
7. After creating the app, generate a **private key** and note the **App ID**
8. Base64-encode the private key for the environment variable:
   ```bash
   cat your-private-key.pem | base64
   ```

### Environment Variables (GitHub App only)

These are only needed if you use Option B (GitHub App). For PAT-based connections, no environment variables are required.

```bash
GITHUB_APP_ID=your-github-app-id
GITHUB_APP_PRIVATE_KEY=base64:your-base64-encoded-private-key
GITHUB_APP_SLUG=your-github-app-slug
```

The `GITHUB_APP_SLUG` is the URL-friendly name of your GitHub App (visible in the app's URL).

---

## Intercom

### Creating an Intercom App (OAuth)

1. Go to [https://developers.intercom.com](https://developers.intercom.com) > **Your Apps** > **New App**
2. Set the **OAuth Redirect URL** to:
   ```
   {NEXT_PUBLIC_APP_URL}/api/integrations/intercom/callback
   ```
3. Note the **Client ID** and **Client Secret** from the Authentication page

**Alternative:** You can skip OAuth entirely and use an Intercom Access Token directly in the Hissuno configuration dialog. In that case, no environment variables are needed.

### Environment Variables (OAuth only)

```bash
INTERCOM_CLIENT_ID=your-intercom-client-id
INTERCOM_CLIENT_SECRET=your-intercom-client-secret
```

---

## Jira

### Creating an Atlassian OAuth App

1. Go to [https://developer.atlassian.com/console/myapps/](https://developer.atlassian.com/console/myapps/) and click **Create** > **OAuth 2.0 integration**
2. Set the **Callback URL** to:
   ```
   {NEXT_PUBLIC_APP_URL}/api/integrations/jira/callback
   ```
3. Under **Permissions**, add **Jira API** with the following scopes:
   - `read:jira-work`
   - `write:jira-work`
   - `read:jira-user`
   - `offline_access`
4. Note the **Client ID** and **Client Secret** from Settings

### Environment Variables

```bash
JIRA_CLIENT_ID=your-jira-client-id
JIRA_CLIENT_SECRET=your-jira-client-secret
```

---

## Linear

### Creating a Linear OAuth App

1. Go to [Linear Settings](https://linear.app/settings/api) > **OAuth Applications** > **New Application**
2. Set the **Callback URL** to:
   ```
   {NEXT_PUBLIC_APP_URL}/api/integrations/linear/callback
   ```
3. Select the scopes: `read`, `write`, `issues:create`, `comments:create`
4. Note the **Client ID** and **Client Secret**
5. Optionally set up a **webhook signing secret** for real-time status sync

### Environment Variables

```bash
LINEAR_CLIENT_ID=your-linear-client-id
LINEAR_CLIENT_SECRET=your-linear-client-secret
LINEAR_WEBHOOK_SIGNING_SECRET=your-linear-webhook-secret  # optional
```
