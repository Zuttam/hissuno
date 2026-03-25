---
title: "Add Your Data"
description: "Learn how to get your product knowledge and customer feedback into Hissuno through the dashboard, CLI, API, or integrations."
---

## Overview

Hissuno works best when it has access to your product knowledge and customer conversations. There are several ways to get data into your project, depending on your workflow.

## From the Dashboard

The Hissuno dashboard provides a visual interface for adding data directly.

### Knowledge Sources

Navigate to **Agents** in the sidebar and open the knowledge sources dialog to add:

- **Codebases** -- Link a GitHub repository so Hissuno can analyze your source code and extract product knowledge automatically.
- **Documents** -- Upload product specs, FAQs, runbooks, or any reference material.
- **URLs** -- Point to public documentation pages that should be indexed.

See [Knowledge Sources](/docs/knowledge/sources) for details on how sources are analyzed and packaged.

### Customer Import

Go to **Customers** in the sidebar and click **Import** to upload a CSV file with customer and feedback data. The import wizard maps your columns to Hissuno fields. Your CSV should include at minimum a customer identifier (email or name) and a feedback content column.

## From the CLI

The [Hissuno CLI](/docs/connect/cli) lets you interact with your Hissuno instance from the terminal:

```bash
npm install -g hissuno
hissuno config
```

Once connected, you can add data directly from the command line:

```bash
# Add a customer company
hissuno add customers
# Interactive prompts: name, domain, ARR, stage, industry...

# Add a feedback session with messages
hissuno add feedback
# Interactive prompts: messages, name, tags...

# Create an issue manually
hissuno add issues
# Interactive prompts: type, title, description, priority...

# List recent feedback sessions
hissuno list feedback --source widget --limit 10

# Search across all data
hissuno search "login issues" --type feedback
```

For scripting and automation, add `--json` before any command to get raw JSON output:

```bash
hissuno --json list issues --priority high | jq '.issues[] | .title'
```

## From the API

The [Hissuno API](/docs/api/overview) provides programmatic access to all project data. Authenticate with an API key from the **Access** page and call endpoints to create sessions, import customers, and more.

```bash
# Create a feedback session with messages
curl -X POST "https://your-instance.com/api/sessions?projectId=YOUR_PROJECT_ID" \
  -H "Authorization: Bearer hiss_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Support chat - Jane",
    "session_type": "chat",
    "messages": [
      { "role": "user", "content": "How do I export my data to CSV?" },
      { "role": "assistant", "content": "You can export from the Reports page using the Export button." }
    ]
  }'
```

See the [Sessions API](/docs/api/sessions), [Issues API](/docs/api/issues), and [Search API](/docs/api/search) for full endpoint reference.

## Through Integrations

Connect external tools to automatically collect customer conversations as feedback sessions:

| Source | Description |
|--------|-------------|
| [Intercom](/docs/integrations/intercom) | Import live chat conversations and tickets |
| [Slack](/docs/integrations/slack) | Monitor channels for customer feedback threads |
| [Gong](/docs/integrations/gong) | Ingest call transcripts from sales and support calls |
| [Jira](/docs/integrations/jira) | Sync issues and comments as feedback |
| [Widget](/docs/integrations/widget) | Embed a support chat directly in your product |

Navigate to **Integrations** in the sidebar to connect any source. Each integration creates feedback sessions automatically once configured.

## Through the Widget

The [Hissuno Widget](/docs/integrations/widget) is an embeddable support chat you add to your application. It connects customers directly to the Hissuno Agent and captures every conversation as a feedback session.

```bash
npm install @hissuno/widget
```

See the [Widget Installation](/docs/integrations/widget) guide for setup instructions.

## How Feedback Is Processed

When data arrives from any source, Hissuno processes it automatically:

1. **Ingestion** -- The raw conversation is stored and associated with a customer profile.
2. **Tagging** -- The AI classifies the session (e.g., `bug`, `feature_request`, `change_request`).
3. **PM Review** -- The PM Copilot analyzes the session and either creates a new issue or upvotes an existing one.
4. **Notification** -- If the feedback triggers a new issue or crosses a vote threshold, relevant team members are notified.

This pipeline runs automatically with no manual intervention required.
