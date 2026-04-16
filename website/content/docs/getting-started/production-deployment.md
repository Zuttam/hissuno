---
title: "Production Deployment"
description: "Deploy Hissuno to production using a cloud provider like Vercel and a managed PostgreSQL database like Neon."
---

## Overview

This guide covers deploying Hissuno to a production environment using a cloud hosting provider and a managed PostgreSQL database. The example uses Vercel and Neon, but the same approach works with any hosting platform and any PostgreSQL provider that supports pgvector.

## Prerequisites

- A GitHub account (to fork/push the repository)
- A [Neon](https://neon.tech), [Supabase](https://supabase.com), or [Railway](https://railway.app) account for managed PostgreSQL
- A [Vercel](https://vercel.com), [Netlify](https://netlify.com), or similar account for hosting
- An [OpenAI API key](https://platform.openai.com)
- Node.js 20+ installed locally
- The Hissuno CLI installed: `npm i -g hissuno`

## Step 1: Create Your Database

Create a PostgreSQL database with pgvector enabled.

### Neon

1. Sign up at [neon.tech](https://neon.tech) and create a new project
2. Enable the pgvector extension:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

3. Copy your connection string from the dashboard (e.g. `postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb`)

### Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. pgvector is enabled by default
3. Copy the connection string from **Settings** > **Database** > **Connection string** (use the URI format)

## Step 2: Deploy to Your Hosting Provider

### Vercel

1. Fork or push the Hissuno repository to GitHub
2. Import the repository in [Vercel](https://vercel.com/new)
3. Set the **Root Directory** to `app`
4. Add these environment variables in the Vercel dashboard:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Your database connection string |
| `AUTH_SECRET` | Generate with `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | Your deployment URL (e.g. `https://hissuno.example.com`) |
| `OPENAI_API_KEY` | Your OpenAI API key |

5. Deploy. Vercel will build and start the application.

## Step 3: Push Schema and Seed Data

From your local machine, use the CLI to push the database schema and seed demo data against your production database.

```bash
cd hissuno/app

hissuno setup --only env,database,seed --app-dir . --env prod
```

This will:

1. **Prompt for your database URL** - enter your Neon/Supabase connection string
2. **Prompt for your app URL** - enter your deployment URL (e.g. `https://hissuno.example.com`)
3. **Prompt for an OpenAI key** - enter your key (or skip if already set in your hosting dashboard)
4. **Write `.env.prod`** locally with these values
5. **Push the database schema** using Drizzle
6. **Seed demo data** - creates an admin user, a demo project, and sample data

After seeding, note the admin credentials and API key printed in the output.

## Step 4: Connect the CLI

Point your local CLI at your production instance:

```bash
hissuno config
```

When prompted, enter:

- **Base URL** - your deployment URL (e.g. `https://hissuno.example.com`)
- **API key** - the key from the seed output (starts with `hiss_`)

Verify the connection:

```bash
hissuno status
```

## Step 5: Log In

Open your deployment URL in a browser and log in with the seeded credentials:

- **Email:** `admin@hissuno.com`
- **Password:** `AdminPass123!`

**Change the admin password immediately** after your first login.

If you skipped the seed step, click **Sign Up** to create a new account.

## Custom Domain

If you're using Vercel, add a custom domain from **Settings** > **Domains** in your Vercel project. Update `NEXT_PUBLIC_APP_URL` to match the new domain, and redeploy.

## Configuring Integrations

OAuth-based integrations (Slack, GitHub App, Jira, Linear) require additional environment variables set in your hosting dashboard. See [Self-Hosting Integration Setup](/docs/integrations/self-hosting-setup) for provider-specific instructions.

API-key integrations (Gong, Zendesk, Intercom) work without any server-side configuration - just enter your credentials in the Hissuno dashboard.

## Next Steps

- [Create your first project](/docs/getting-started/first-project) and connect knowledge sources
- [Configure integrations](/docs/integrations/self-hosting-setup) for Slack, GitHub, and more
- [Connect your AI agents](/docs/connect/overview) via CLI or API
