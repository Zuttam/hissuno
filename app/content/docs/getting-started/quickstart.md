---
title: "Quickstart"
description: "Get Hissuno running and see your first AI-powered support response in under 5 minutes."
---

Set up a local Hissuno instance, add product knowledge, and get an AI-powered answer to a customer question - all in about five minutes.

## 1. Install

```bash
npm i -g hissuno && hissuno setup
```

The setup wizard handles everything: cloning the repository, installing dependencies, provisioning PostgreSQL with pgvector, generating your `.env` file, pushing the database schema, and optionally seeding demo data. Follow the prompts and you will have a running instance at `http://localhost:3000`.

## 2. Create Your Project

1. Open [localhost:3000](http://localhost:3000) in your browser.
2. Sign up with an email and password.
3. Click **New Project** and enter your product name (e.g., "Acme Web App").
4. Click **Create Project** to land on your new project dashboard.

## 3. Connect the CLI

While the knowledge source analyzes, connect the CLI to your instance:

```bash
hissuno config
```

Enter your API key (from **Settings > Access**) and your instance URL. Verify the connection:

```bash
hissuno status
```

```
Connected to Hissuno
  URL:     http://localhost:3000
  Project: Acme Web App
  Role:    owner
```

## 4. Add Knowledge

The fastest way to give Hissuno context about your product is a website URL.

1. In the sidebar, go to **Agents** and open the knowledge sources dialog.
2. Click **Add Source** and select **URL**.
3. Paste a link to your docs site, marketing page, or any public page that describes your product.
4. Click **Save**. Hissuno will crawl the page and analyze its content automatically.

Check progress from the CLI:

```bash
hissuno list sources
```

## 5. Try the Support Agent

Once the knowledge analysis completes, test it out.

1. Look for the chat widget in the bottom-right corner of the dashboard.
2. Open it and ask a question about your product - something a customer would ask.
3. The Support Agent answers using the knowledge you just added.

If the answer references your product correctly, you are up and running. You can also search your knowledge from the terminal:

```bash
hissuno search "how does pricing work" --type knowledge
```

## What's Next

- [Add Your Data](/docs/getting-started/add-your-data) - Connect more data sources like GitHub repos, documents, and customer conversations.
- [Connect Your Tools](/docs/connect/overview) - Set up MCP, CLI, or API access for external agents and workflows.
- [Configure Agents](/docs/agents/overview) - Customize agent behavior, tone, and knowledge priorities.
- [Production Deployment](/docs/getting-started/production-deployment) - Deploy to Vercel + Neon for a production-ready setup.
