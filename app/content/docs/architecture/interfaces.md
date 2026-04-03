---
title: "Interfaces"
description: "The agentic interfaces and integration points that expose Hissuno's knowledge graph to external tools and agents."
---

## Overview

The Execution layer exposes Hissuno's knowledge graph through a set of interfaces. Each interface gives a different audience - AI agents, developers, customers, or team members - a way to read from and write to the graph.

## MCP Server

Exposes the knowledge graph to AI agents (Claude Desktop, Cursor, Claude Code) via the Model Context Protocol. Agents can search feedback, list issues, query knowledge, create resources, and ask Hissuno questions through a standard tool interface. [Learn more](/docs/connect/mcp)

## CLI

Terminal access to all project data. Set up instances, configure connections, query and create resources, manage integrations. The CLI supports both interactive and non-interactive (agent-ready) modes for use in scripts and automation pipelines. [Learn more](/docs/connect/cli)

## Skills

Claude Code skills that inject Hissuno context into coding workflows. Query product knowledge and feedback without leaving the editor. Skills surface relevant issues, customer feedback, and knowledge graph data directly in your development environment. [Learn more](/docs/connect/skills)

## API

RESTful access to feedback, issues, search, and project data. Build custom integrations or connect tools that don't support MCP. The API uses Bearer token authentication with API keys scoped to individual projects. [Learn more](/docs/api/overview)

## Widget

Embeddable chat component for websites and applications. Connects customers directly to the Support Agent and captures conversations as feedback. The widget supports custom branding, authenticated users, and headless mode for full UI control. [Learn more](/docs/integrations/widget)

## Slack

Bot integration for workspace channels. Captures customer conversations as feedback, supports interactive and passive channel modes, and enables human takeover. When a customer messages in a connected channel, the Support Agent responds and the conversation is recorded in the knowledge graph. [Learn more](/docs/integrations/slack)
