---
title: "Interfaces"
description: "The agentic interfaces and integration points that expose Hissuno's knowledge graph to external tools and agents."
---

## Overview

The Execution layer exposes Hissuno's knowledge graph through a set of interfaces. Each interface gives a different audience - AI agents, developers, customers, or team members - a way to read from and write to the graph.

## CLI

Terminal access to all project data. Set up instances, configure connections, query and create resources, manage integrations. The CLI supports both interactive and non-interactive (agent-ready) modes for use in scripts and automation pipelines. [Learn more](/docs/connect/cli)

## Skills

Claude Code skills that inject Hissuno context into coding workflows. Query product knowledge and feedback without leaving the editor. Skills surface relevant issues, customer feedback, and knowledge graph data directly in your development environment. [Learn more](/docs/connect/skills)

## API

RESTful access to feedback, issues, search, and project data. Build custom integrations and automate workflows. The API uses Bearer token authentication with API keys scoped to individual projects. [Learn more](/docs/api/overview)

## Widget

Embeddable chat component for websites and applications. Connects customers directly to the Support Agent and captures conversations as feedback. The widget supports custom branding, authenticated users, and headless mode for full UI control. [Learn more](/docs/integrations/widget)

## Slack

Bot integration for workspace channels. Captures customer conversations as feedback, supports interactive and passive channel modes, and enables human takeover. When a customer messages in a connected channel, the Support Agent responds and the conversation is recorded in the knowledge graph. [Learn more](/docs/integrations/slack)

## Integration Plugins

Every provider that feeds data into Hissuno - Slack, GitHub, Linear, Jira, Intercom, Zendesk, Notion, HubSpot, Gong, Fathom, PostHog - is a **plugin** built on a unified plugin kit. A plugin declares its auth schema and data streams; shared infrastructure handles routing, cron, credential storage, deduplication, and ingestion. Plugins can ship live webhook handlers, scheduled syncs, per-instance configuration, and custom API endpoints. [Learn more](/docs/architecture/plugin-system)
