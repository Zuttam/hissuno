---
status: done
created: 2026-02-16
impact: high
summary: Thin MCP server exposing the Hissuno support agent as a coworker tool via Streamable HTTP
---

# Plan: Hissuno MCP Server

## Context

Hissuno needs an MCP (Model Context Protocol) server so that external agents can interact with the platform. The design is a **thin agent layer**: external agents (Claude Desktop, Cursor, third-party platforms) talk to Hissuno like a coworker via a single `ask_hissuno` tool. Under the hood, the existing support agent (with all its Mastra tools) handles the reasoning and data access.

This avoids duplicating data access logic — the support agent's Mastra tools are the single source of truth for querying issues, feedback, contacts, and knowledge. When those tools improve, every consumer benefits.

## Architecture

### Thin MCP → Support Agent

```
External Agent (Claude Desktop, Cursor, etc.)
    ↓ MCP Streamable HTTP
Hissuno MCP Server (auth + context)
    ↓ ask_hissuno tool
Support Agent (Mastra tools: knowledge, issues, sessions, contacts)
    ↓
Supabase DB
```

### Single tool: `ask_hissuno`

| Tool | Params | Description |
|------|--------|-------------|
| `ask_hissuno` | question, thread_id (optional) | Ask Hissuno about your product, customers, issues, or feedback. Hissuno uses its knowledge base and product intelligence tools to answer. |

The same tool serves both auth modes — the auth context determines what the support agent can access.

### Two-Tier Auth

API keys are always project-scoped (no cross-tenant access).

**User mode** (Hissuno users):
- Auth: `Authorization: Bearer hiss_*` (API key only)
- Support agent gets full project access

**Contact mode** (end users):
- Auth: `Authorization: Bearer hiss_*` + `X-Contact-Token: <jwt>`
- JWT signed with project's `secret_key` (same HS256 as widget auth)
- Support agent context is scoped to that contact

### Auth flow

```
Request -> Extract API key -> resolveApiKey() -> get projectId
       -> Check X-Contact-Token header
       -> If present: verify JWT -> resolve contact -> contact context
       -> If absent: user context
       -> Build RuntimeContext for support agent
       -> Invoke agent with question
```

### Slack dual-mode: Contact JWT from identification flow

The Slack message processor generates a contact JWT during the existing identification flow:

```
Slack event -> SlackClient.getUserInfo(userId) -> extract email
           -> generateWidgetJWT({ userId: email, userMetadata }, project.secretKey)
           -> store contactToken in RuntimeContext
```

This is stored in `SupportAgentContext.contactToken` for future use when the support agent calls MCP tools.

### Standalone Node.js HTTP server

Runs as a separate process at `app/src/mcp/`. Uses `dotenv` to load `.env.local` before module imports (needed because `embedding-service.ts` eagerly creates an OpenAI client).

**Transport**: Streamable HTTP — stateless mode (no sessions).

**Context passing**: AsyncLocalStorage passes auth context to tool handlers.

## File Structure

```
app/src/mcp/
  server.ts    # Bootstrap: loads env, dynamic import of app.ts
  app.ts       # HTTP server, auth routing, MCP transport
  auth.ts      # API key + JWT verification, mode resolution
  context.ts   # AsyncLocalStorage for McpContext
  tools.ts     # ask_hissuno tool → invokes support agent
```

## Key Reusable Code

| Existing Function | File | Reuse |
|---|---|---|
| `resolveApiKey(key)` | `app/src/lib/auth/api-keys.ts` | API key auth |
| `verifyWidgetJWT(token, secretKey)` | `app/src/lib/utils/widget-auth/index.ts` | Contact JWT verification |
| `generateWidgetJWT(payload, secretKey)` | `app/src/lib/utils/widget-auth/index.ts` | Slack contact JWT generation |
| `createAdminClient()` | `app/src/lib/supabase/server.ts` | DB queries in auth |
| `mastra.getAgent('supportAgent')` | `app/src/mastra/index.ts` | Agent invocation |

## Dependencies

```
@modelcontextprotocol/sdk    # McpServer, StreamableHTTPServerTransport
```

## npm Scripts

```json
"mcp:server": "tsx --tsconfig tsconfig.mcp.json src/mcp/server.ts",
"mcp:dev": "tsx watch --tsconfig tsconfig.mcp.json src/mcp/server.ts"
```

Default port: `3100` (configurable via `MCP_PORT` env var).

## Verification

1. **Start server**: `cd app && npm run mcp:dev`
2. **Health check**: `curl http://localhost:3100/health` -> `{"status":"ok"}`
3. **Auth rejection**: `curl -X POST http://localhost:3100/mcp` -> 401
4. **Tool discovery**: API key -> `tools/list` returns `ask_hissuno`
5. **Ask Hissuno**: `ask_hissuno("What are the top issues?")` -> agent response
6. **Claude Desktop**: Configure MCP client, verify tool discovery and execution
