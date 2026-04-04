---
title: "GitHub Integration"
description: "Connect GitHub repositories to Hissuno for automatic codebase analysis and knowledge extraction."
---

## Overview

The GitHub integration allows Hissuno to analyze your codebase and extract product knowledge that powers the Hissuno Agent. When connected, Hissuno reads your repository structure, documentation, and code comments to build a deep understanding of your product.

This knowledge is used by the Hissuno Agent to answer customer questions accurately and by the PM Agent to map feedback to specific areas of your codebase.

## Self-Hosting Setup

If you are self-hosting Hissuno, you need to create your own GitHub App before using this integration. See the [Self-Hosting Integration Setup](/docs/integrations/self-hosting-setup#github) guide for step-by-step instructions on creating a GitHub App and configuring the required environment variables.

## Connecting a Repository

### Prerequisites

- A GitHub account with admin access to the repository you want to connect
- An active Hissuno project

### Setup Steps

1. Navigate to **Integrations** in the sidebar and click **Configure** on the GitHub card
2. Click **Connect GitHub**
3. You will be redirected to GitHub to authorize the Hissuno GitHub App
4. Select the repositories you want Hissuno to access
5. Confirm the installation

Once authorized, your repositories will appear in the integration panel. Select which repository to link to your Hissuno project.

Select which repository to link from the configuration dialog.

### Repository Permissions

Hissuno requests the following GitHub App permissions:

| Permission | Access | Purpose |
|------------|--------|---------|
| Repository contents | Read | Analyze source code, docs, and config files |
| Metadata | Read | List repositories and branches |
| Webhooks | Read & Write | Receive push events for auto-sync |
| Pull requests | Read | Track changes and feature context |

Hissuno never writes to your repository or modifies any code. All access is strictly read-only for content analysis.

## Codebase Analysis

When you first connect a repository, Hissuno runs a full codebase analysis. This process:

1. **Scans the repository** -- Identifies key files including README, docs, configuration, and source code
2. **Extracts product knowledge** -- The Codebase Analyzer agent reads your code and pulls out feature descriptions, API endpoints, configuration options, and user-facing behavior
3. **Compiles knowledge packages** -- Findings are categorized into business, product, and technical knowledge
4. **Sanitizes output** -- The Security Scanner removes any sensitive information such as API keys, secrets, or internal credentials before storing results

The analysis typically takes 2-5 minutes depending on repository size.

### Supported File Types

Hissuno analyzes the following file types during codebase analysis:

- **Documentation**: `.md`, `.mdx`, `.rst`, `.txt`
- **Source code**: `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.go`, `.java`, `.rb`
- **Configuration**: `.json`, `.yaml`, `.yml`, `.toml`, `.env.example`
- **API definitions**: OpenAPI/Swagger specs, GraphQL schemas

### Ignored Paths

The following paths are excluded from analysis by default:

- `node_modules/`, `vendor/`, `.git/`
- Build output directories (`dist/`, `build/`, `.next/`)
- Binary files and images
- Test fixtures and mock data

## Auto-Sync on Push

After the initial analysis, Hissuno keeps your knowledge base up to date automatically.

### How It Works

When you push to your default branch (typically `main` or `master`), Hissuno receives a webhook event from GitHub. It then:

1. Identifies which files changed in the push
2. Re-analyzes only the modified files
3. Updates the relevant knowledge packages
4. Makes the new knowledge immediately available to your AI agents

### Branch Configuration

By default, Hissuno syncs with your repository's default branch. You can change this in the integration settings:

Navigate to **Integrations** in the sidebar, click **Configure** on the GitHub card, and change the sync branch.

Only one branch can be synced at a time per project.

### Manual Re-sync

You can trigger a full re-analysis at any time from the integration settings page or from the CLI:

```bash
hissuno integrations sync github
```

This is useful after major refactors or when you first set up the integration and want to ensure all knowledge is captured.

## Troubleshooting

### Analysis Not Running

If the initial analysis does not start after connecting:

- Verify that the GitHub App has the correct permissions on your repository
- Check that the repository is not empty
- Ensure your Hissuno project has an active subscription

### Webhook Events Not Arriving

If auto-sync is not triggering on push:

- Go to your GitHub repository settings and verify the Hissuno webhook is listed under **Webhooks**
- Check that the webhook shows recent successful deliveries
- Re-install the GitHub App if the webhook is missing

### Disconnecting

To remove the GitHub integration, navigate to **Integrations** in the sidebar, click **Configure** on the GitHub card, and click **Disconnect**. This removes the repository link and deletes all extracted knowledge associated with it. The GitHub App authorization remains on your GitHub account until you manually revoke it.
