---
title: "Connect to Hissuno"
description: "Overview of the ways external AI agents and tools can connect to your Hissuno project."
---

## Overview

Hissuno exposes your project's knowledge, feedback, issues, and customer data to external AI agents and developer tools. There are several ways to connect, depending on your workflow.

## CLI

The [Hissuno CLI](/docs/connect/cli) (`hissuno`) gives you terminal access to your project data. Set up new instances, configure connections, query feedback, issues, contacts, and knowledge, manage integrations - all from the command line.

```bash
npm install -g hissuno
hissuno config
```

## Skills

[Claude Code Skills](/docs/connect/skills) let you add Hissuno context directly into your coding workflow. Skills provide structured prompts that Claude Code can use to pull in relevant product knowledge and feedback while you work.

## API

The [REST API](/docs/api/overview) provides full programmatic access to all project data. Use it to build custom integrations and automate workflows.

## Authentication

All connection methods require an API key generated from the **Access** page in your project settings. See [Authentication](/docs/api/authentication) for details on generating, managing, and rotating keys.
