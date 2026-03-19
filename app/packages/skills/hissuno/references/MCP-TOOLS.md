# Hissuno MCP Tools

Alternative to the CLI for agents that support MCP (Claude Desktop, Cursor, etc.). The CLI can do everything the MCP server can, so MCP is only needed if your environment prefers native tool calls over shell commands.

## Setup

The MCP server runs as a Streamable HTTP endpoint alongside the main Hissuno app.

### 1. Start the MCP server

```bash
# From the Hissuno app directory
npx tsx src/mcp/app.ts
```

The server starts on `http://localhost:3100` by default. Override with `MCP_PORT` env var.

### 2. Configure your MCP client

Add to your MCP client config (e.g. `~/.claude/mcp.json` or Cursor settings):

```json
{
  "mcpServers": {
    "hissuno": {
      "type": "streamable-http",
      "url": "http://localhost:3100/mcp",
      "headers": {
        "Authorization": "Bearer hiss_your_api_key_here"
      }
    }
  }
}
```

### 3. Verify

Health check: `GET http://localhost:3100/health`

## Authentication

- **API key** (required): `Authorization: Bearer hiss_...` - scopes access to the key's project
- **Contact token** (optional): `X-Contact-Token: <JWT>` - further scopes access to a single contact within the project

## Tools

### `list_resource_types`

Returns all resource types with their filters, search behavior, and add fields. Call this first to understand what data is available.

**Args:** none

### `list_resources`

Browse resources with optional filters.

**Args:**
| Arg | Required | Description |
|-----|----------|-------------|
| `type` | yes | `knowledge`, `feedback`, `issues`, `customers` |
| `filters` | no | Object of filters (see `list_resource_types` for available filters per type) |
| `limit` | no | Max results (default: 20, max: 50) |

### `get_resource`

Get full details of a specific resource including relationships.

**Args:**
| Arg | Required | Description |
|-----|----------|-------------|
| `type` | yes | `knowledge`, `feedback`, `issues`, `customers` |
| `id` | yes | Resource UUID |

### `search_resources`

Semantic search across resources using natural language.

**Args:**
| Arg | Required | Description |
|-----|----------|-------------|
| `query` | yes | Natural language search query |
| `type` | no | Limit to one type (omit to search all) |
| `limit` | no | Max results per type (default: 10, max: 20) |

### `add_resource`

Create a new resource. Not available in contact mode.

**Args:**
| Arg | Required | Description |
|-----|----------|-------------|
| `type` | yes | `knowledge`, `feedback`, `issues`, `customers` |
| `data` | yes | Object with resource fields (see `list_resource_types`) |

### `ask_hissuno`

Ask the Hissuno agent a natural language question. It has access to all knowledge, feedback, issues, and contacts within the project.

**Args:**
| Arg | Required | Description |
|-----|----------|-------------|
| `question` | yes | Your question or request |
| `thread_id` | no | Thread ID to continue a previous conversation |

## CLI Equivalents

| MCP Tool | CLI Command |
|----------|-------------|
| `list_resource_types` | `hissuno types` |
| `list_resources` | `hissuno list <type>` |
| `get_resource` | `hissuno get <type> <id>` |
| `search_resources` | `hissuno search <query>` |
| `add_resource` | `hissuno add <type>` |
| `ask_hissuno` | No CLI equivalent |

Note: `scopes` (product scopes) are CLI-only and not available via MCP. `ask_hissuno` is MCP-only.
