---
title: "Analysis Workflow"
description: "How Hissuno's multi-step AI pipeline analyzes your sources and builds knowledge packages."
---

## Overview

The knowledge analysis workflow is a multi-step AI pipeline that processes your knowledge sources and produces categorized knowledge packages. It coordinates multiple specialized AI agents, each responsible for a different phase of the analysis.

The workflow runs asynchronously and streams progress events to the dashboard in real time, so you can monitor each step as it executes.

## Workflow Steps

The analysis pipeline consists of eight sequential steps:

### 1. Prepare Codebase

If your project has a codebase knowledge source connected to a GitHub repository, this step acquires a lease on the repository and syncs it to an ephemeral local directory. The lease system prevents concurrent analyses from interfering with each other.

- The repository is cloned or pulled to get the latest code from the configured branch
- A commit SHA is recorded so the analysis is tied to a specific point in time
- If no codebase source is configured, this step is a no-op and the workflow proceeds

### 2. Analyze Codebase

The **Codebase Analyzer** agent uses filesystem tools to intelligently explore the synced repository. Rather than reading every file, the agent follows an exploration strategy:

1. Lists the top-level project structure
2. Reads key configuration files (package.json, README, tsconfig, etc.)
3. Explores main source directories (src/, app/, pages/)
4. Searches for important patterns like API routes, components, and data models

The agent is allowed up to 15 tool-use steps to thoroughly explore the codebase. If an analysis scope is configured (e.g., `packages/api` for a monorepo), the agent focuses only on that subdirectory.

The output is a comprehensive analysis covering product overview, key features, technical architecture, API references, data models, and common use cases.

### 3. Analyze Sources

Each non-codebase knowledge source is processed according to its type:

| Source Type | Processing |
|-------------|-----------|
| Website | Fetched via HTTP, HTML converted to text, analyzed by Web Scraper agent |
| Documentation Portal | Crawled (up to 50 pages with rate limiting), combined content analyzed by agent |
| Uploaded Document | Read from secure storage |
| Raw Text | Used directly from database |

Sources are processed sequentially, and progress events report which source is being processed and how many have completed.

### 4. Compile Knowledge

The **Knowledge Compiler** agent receives all analysis results and categorizes them into five knowledge packages:

- **Business**: Company info, pricing, policies, contact details
- **Product**: Features, use cases, capabilities, limitations
- **Technical**: API reference, architecture, data models, integrations
- **FAQ**: Frequently asked questions organized by topic
- **How-To**: Step-by-step tutorials and getting-started guides

The compiler uses structured output to return a JSON object with each category as a key, ensuring consistent formatting across runs.

### 5. Sanitize Knowledge

The **Security Scanner** agent scans each compiled package for sensitive information. It identifies and redacts:

- API keys, tokens, and secrets
- Database connection strings and passwords
- AWS credentials and private keys
- Internal IP addresses and infrastructure details

Each category is scanned independently. Sensitive values are replaced with descriptive placeholders (e.g., `[REDACTED_API_KEY]`). A redaction summary is generated with the total count and types of sensitive data found.

If no sensitive data is detected, the packages pass through unchanged.

### 6. Save Packages

The sanitized knowledge packages are saved to secure cloud storage as versioned Markdown files. The storage path follows the pattern `{projectId}/{category}-v{version}.md`.

Database records are created or updated for each category, linking the stored file to the project with version tracking and a generation timestamp.

### 7. Embed Knowledge

The saved packages are split into chunks and each chunk is converted to a vector embedding for semantic search. This indexing enables the support agent to find the most relevant knowledge when answering customer questions.

### 8. Cleanup Codebase

The codebase lease is released and the local directory is cleaned up if no other analysis is using it. This ensures ephemeral storage is not left behind after the workflow completes.

## Triggering Analysis

### From the Dashboard

Navigate to the **Agents** page from the sidebar, click on a knowledge package to open the Knowledge Detail dialog, and click the **Run Analysis** button. The analysis starts immediately and progress events stream to the UI in real time.

### Automatic Triggers

Analysis does not run on a schedule by default. It must be triggered manually from the dashboard or programmatically via the analysis API.

### Conflict Prevention

Only one analysis can run per project at a time. If you attempt to start a new analysis while one is already in progress, the system returns an error with the existing run ID. You must wait for the current analysis to complete or cancel it before starting a new one.

## Monitoring Progress

When analysis is running, the dashboard displays a live progress stream with messages from each step:

- "Starting codebase analysis..."
- "Exploring project structure..."
- "Using 3 tool(s)..."
- "Processing source 2/4: website"
- "Crawled 23 pages from docs portal"
- "Categorizing into business, product, technical, faq, and how-to..."
- "Scanning for sensitive information..."
- "Redacted 3 sensitive item(s) across all packages"
- "Knowledge packages compiled successfully"

These messages are delivered via Server-Sent Events (SSE) so the page does not need to be refreshed.

## Analysis Records

Each analysis run creates a record in the `project_analyses` table with:

- **Run ID**: A unique identifier for the workflow execution
- **Status**: `running`, `completed`, or `failed`
- **Metadata**: Source count, whether a codebase was included, source IDs, branch name, and the full workflow input
- **Timestamps**: When the analysis started and completed

You can view past analysis runs in the Knowledge Detail dialog on the **Agents** page to track history and diagnose failures.

## Handling Failures

If a step fails, the workflow records the error and the analysis status is set to `failed`. Common failure scenarios:

| Failure | Cause | Resolution |
|---------|-------|------------|
| GitHub clone fails | Invalid credentials or branch | Re-authenticate the GitHub App or verify the branch name |
| Website fetch fails | Unreachable URL or HTTP error | Check the URL is accessible and returns a valid response |
| Compilation timeout | Very large combined content | Reduce the number of sources or use analysis scope to narrow codebase analysis |
| Agent not configured | Missing AI agent in Mastra setup | Verify the agent configuration in your deployment |

Individual source failures do not halt the entire workflow. If one source fails, its error is recorded and the remaining sources continue processing. The compilation step works with whatever content was successfully extracted.

## Re-Running Analysis

After making changes to your knowledge sources (adding, removing, or updating), re-run the analysis to regenerate packages. The new run replaces all existing packages with fresh versions based on the current source state.

Source statuses are reset to **Processing** at the start of each run and updated to **Completed** or **Failed** when the run finishes.
