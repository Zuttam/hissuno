---
title: "MCP Server"
description: "Connect AI agents to Hissuno via the Model Context Protocol (MCP) server."
---

## Overview

The Hissuno MCP server lets external AI agents — Claude Desktop, Cursor, Claude Code, and any MCP-compatible client — interact with your Hissuno project as a coworker. Agents can ask questions, search feedback, list issues, create contacts, and more, all through a standard MCP interface.

## Prerequisites

You need a Hissuno API key to authenticate. See [API Authentication](/docs/api/authentication) for how to generate one from the **Access** page in your project settings.

## Endpoint

```
https://<your-hissuno-host>/api/mcp
```

Replace `<your-hissuno-host>` with your Hissuno instance URL (e.g. `app.hissuno.com` for the hosted version, or your own domain for self-hosted deployments).

The server uses Streamable HTTP transport (the MCP standard for remote servers).

## Available Tools

The MCP server exposes 6 tools:

| Tool | Description |
|------|-------------|
| `ask_hissuno` | Ask the Hissuno agent a natural-language question about your product, customers, issues, or feedback. Supports multi-turn conversations via an optional `thread_id`. |
| `list_resource_types` | List all available resource types with their supported filters and fields. Call this first to understand what data you can query. |
| `list_resources` | List resources of a given type with optional filters and a configurable limit (default 20, max 50). |
| `get_resource` | Get full details of a specific resource by type and ID. Returns a comprehensive markdown document. |
| `search_resources` | Semantic search across resources using natural language. Optionally scope to a single resource type. |
| `add_resource` | Create a new resource (feedback, issue, or contact). Not available in contact mode. |

## Resource Types

### knowledge

Analyzed knowledge sources (codebases, documents, URLs).

- **Filters:** none
- **Search:** semantic vector search across all knowledge chunks
- **Add:** not supported (use the dashboard)

### feedback

Customer feedback sessions from widget, Slack, Intercom, Gong, API, or manual entry.

- **Filters:** `source`, `status`, `tags`, `contact_id`, `search`
- **Search:** semantic vector search (full-text fallback for unanalyzed sessions)
- **Add:** required `messages` (array of `{role, content}`); optional `name`, `tags`

### issues

Product issues — bugs, feature requests, and change requests.

- **Filters:** `type`, `priority`, `status`, `search`
- **Search:** semantic vector search for similar issues
- **Add:** required `type`, `title`, `description`; optional `priority`

### contacts

Customer contacts with linked feedback and issues.

- **Filters:** `search`, `company_id`, `role`
- **Search:** semantic vector search (name/email text fallback)
- **Add:** required `name`, `email`; optional `role`, `title`, `phone`, `company_id`, `is_champion`

## Configuration

### Claude Desktop

Add to your Claude Desktop config file (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "hissuno": {
      "type": "streamable-http",
      "url": "https://<your-hissuno-host>/api/mcp",
      "headers": {
        "Authorization": "Bearer hiss_YOUR_API_KEY"
      }
    }
  }
}
```

### Cursor

Add to your Cursor MCP settings (`.cursor/mcp.json` in your project or global config):

```json
{
  "mcpServers": {
    "hissuno": {
      "type": "streamable-http",
      "url": "https://<your-hissuno-host>/api/mcp",
      "headers": {
        "Authorization": "Bearer hiss_YOUR_API_KEY"
      }
    }
  }
}
```

### Claude Code

Add to your Claude Code settings (`.claude/settings.json` in your project):

```json
{
  "mcpServers": {
    "hissuno": {
      "type": "streamable-http",
      "url": "https://<your-hissuno-host>/api/mcp",
      "headers": {
        "Authorization": "Bearer hiss_YOUR_API_KEY"
      }
    }
  }
}
```

### Generic MCP Client

Any MCP-compatible client can connect using Streamable HTTP transport with:

- **URL:** `https://<your-hissuno-host>/api/mcp`
- **Auth header:** `Authorization: Bearer hiss_YOUR_API_KEY`

## Contact Mode

By default, the MCP server operates in **user mode** — the agent has full access to your project data (knowledge, feedback, issues, contacts).

You can optionally scope the connection to a specific customer contact by passing an `X-Contact-Token` header alongside the API key. This is useful when building customer-facing integrations where the agent should only see data relevant to that contact.

The contact token is a JWT signed with your project's secret key, containing the contact's email. When present, the agent operates in **contact mode** with scoped access.

## Troubleshooting

### 401 Unauthorized

- Verify the `Authorization` header includes the `Bearer` prefix
- Check that the API key starts with `hiss_`
- Confirm the key has not been revoked on the **Access** page
- Ensure there are no extra spaces or characters in the header

### Connection Timeout

- Confirm the endpoint URL ends with `/api/mcp` (not `/sse` or other paths)
- Check that your MCP client supports Streamable HTTP transport
- Verify your network allows outbound HTTPS connections

### No Data Returned

- Call `list_resource_types` first to see what resource types are available
- Check that your project has data (knowledge sources analyzed, feedback collected, etc.)
- Verify the API key belongs to the correct project
