---
status: pending
created: 2026-02-16
impact: high
summary: Standalone MCP server exposing Hissuno platform data to external and internal agents via Streamable HTTP
---

# Plan: Hissuno MCP Server

## Context

Hissuno needs an MCP (Model Context Protocol) server so that agents can query platform data programmatically. The primary use case: **PMs use the Hissuno Slack agent as a conversational dashboard** — querying issues, feedback, contacts, and knowledge without leaving Slack. Secondary: Claude Desktop, Cursor, and third-party agent platforms.

V1 is read-only tools. V2 will add write operations (update issue status, create issues, etc.) so PMs can take action directly from Slack.

## Two-Tier Auth -> Two Toolsets

The server loads **different tools** based on the auth context. This is enforced at the server level — there is no parameter an agent can omit or spoof to escalate access.

### Admin mode (Hissuno users)
- **Auth**: `Authorization: Bearer hiss_*` (API key only)
- **Tools**: Full project access — `list_issues`, `get_issue`, `list_feedback`, `get_feedback`, `list_contacts`, `get_contact`, `search_knowledge`

### Contact mode (end users)
- **Auth**: `Authorization: Bearer hiss_*` + `X-Contact-Token: <jwt>`
- **JWT**: Signed with the project's `secret_key` (same HS256 system as widget auth). Payload contains `userId` and `userMetadata.email` which maps to a contact.
- **Tools**: Contact-scoped only — `my_issues`, `my_feedback`, `get_my_feedback`, `search_knowledge`
- **Security**: Contact identity comes from the cryptographically verified JWT. No user-supplied email parameter. Tools physically cannot return other users' data.

### Auth flow

```
Request -> Extract API key -> resolveApiKey() -> get projectId
       -> Check X-Contact-Token header
       -> If present: verify JWT with project.secret_key -> resolve contact from email
           -> Register CONTACT tools (scoped to contact_id)
       -> If absent: Register ADMIN tools (full project access)
```

The Hissuno customer's backend generates the contact JWT (same as widget tokens) and passes it to whatever agent framework they use. This means:
- Hissuno user in Claude Desktop: just API key -> admin tools
- Hissuno support agent on Slack/widget: admin API key -> admin tools (agent handles data scoping server-side, filtering by contact)
- End user via third-party agent: API key + contact JWT -> contact tools only

### Why admin mode for Slack

The Slack support agent is trusted server-side code. It knows the end user's identity from Slack (resolved to email). It uses admin tools with contact filtering (e.g., `list_feedback` with `contact_id` param) and controls what data reaches the end user. No JWT needed because the agent — not the end user — is the MCP consumer.

## Architecture

### Standalone Node.js HTTP server

The MCP server runs as a separate process alongside the Next.js app. It lives in the same codebase at `app/src/mcp/` and imports existing service functions directly.

**Why standalone (not a Next.js API route)**:
- MCP SDK's `NodeStreamableHTTPServerTransport` expects Node.js native `http.IncomingMessage`/`http.ServerResponse`, not Web API Request/Response
- MCP servers are conventionally standalone processes
- Clean separation; no interference with Next.js middleware or auth flows

**Transport**: Streamable HTTP (modern MCP transport) — stateless mode (no sessions). Each POST creates a fresh transport. This is correct for V1 since all tools are independent read-only queries.

### Data access via admin client

The existing query functions (`listIssues`, `listSessions`, etc.) use React's `cache()` and `createClient()` (cookie-based auth) — unusable outside Next.js. The MCP server creates a **thin data layer** in `app/src/mcp/data/` that:
- Uses `createAdminClient()` (service role, bypasses RLS)
- Always scopes queries by `project_id` from the resolved API key
- For contact mode: additionally scopes by `contact_id` from the verified JWT

**Direct imports** (already use admin client): `searchKnowledgeEmbeddings()`, `getSessionMessages()`

### Context passing via AsyncLocalStorage

Auth context is passed to tool handlers via Node.js `AsyncLocalStorage`:
- Admin mode: `{ mode: 'admin', projectId, keyId, createdByUserId }`
- Contact mode: `{ mode: 'contact', projectId, keyId, createdByUserId, contactId, contactEmail }`

## File Structure

```
app/src/mcp/
  server.ts              # Entry point: HTTP server, auth routing, MCP setup
  auth.ts                # API key + JWT verification, mode resolution
  context.ts             # AsyncLocalStorage for McpContext
  tools/
    index.ts             # registerAdminTools() + registerContactTools()
    admin/
      list-issues.ts
      get-issue.ts
      list-feedback.ts
      get-feedback.ts
      list-contacts.ts
      get-contact.ts
      search-knowledge.ts
    contact/
      my-issues.ts       # Issues linked to the contact's sessions
      my-feedback.ts     # The contact's feedback sessions
      get-my-feedback.ts # Single feedback detail (verified ownership)
      search-knowledge.ts
  data/
    index.ts             # Shared helpers
    issues.ts            # Admin-client issue queries
    sessions.ts          # Admin-client session/message queries
    contacts.ts          # Admin-client contact queries
app/tsconfig.mcp.json    # Extends base tsconfig for tsx path aliases
```

## V1 Tools

### Admin tools (7)

| Tool | Params | Description |
|------|--------|-------------|
| `list_issues` | type, priority, status, search, contact_id, company_id, limit, offset | List/filter/search issues. Optional contact_id/company_id to scope to a customer. |
| `get_issue` | issue_id | Get issue detail with linked feedback sessions and customer impact |
| `list_feedback` | status, source, tags, date_from, date_to, search, contact_id, company_id, limit, offset | List/filter feedback. Optional contact_id/company_id to scope to a customer. |
| `get_feedback` | feedback_id, include_messages (default: true) | Get feedback detail with conversation messages |
| `list_contacts` | search, company_id, limit, offset | List contacts with company info |
| `get_contact` | contact_id | Get contact with linked sessions and issues |
| `search_knowledge` | query, categories, limit | Semantic search across project knowledge base |

### Contact tools (4)

| Tool | Description |
|------|-------------|
| `my_issues` | Issues linked to the authenticated contact's sessions (type, priority, status, limit) |
| `my_feedback` | The authenticated contact's feedback sessions (status, limit) |
| `get_my_feedback` | Detail of a specific feedback session with messages (verified ownership) |
| `search_knowledge` | Semantic search across project knowledge base (knowledge is project-wide) |

## Key Reusable Code

| Existing Function | File | Reuse |
|---|---|---|
| `resolveApiKey(key)` | `app/src/lib/auth/api-keys.ts` | Direct import for API key auth |
| `verifyWidgetJWT(token, secretKey)` | `app/src/lib/utils/widget-auth/index.ts` | Direct import for contact JWT verification |
| `createAdminClient()` | `app/src/lib/supabase/server.ts` | Direct import for all DB queries |
| `searchKnowledgeEmbeddings()` | `app/src/lib/knowledge/embedding-service.ts` | Direct import (already uses admin client) |
| `getSessionMessages()` | `app/src/lib/supabase/session-messages.ts` | Direct import (already uses admin client) |
| Query select strings | `app/src/lib/supabase/issues.ts:31-38`, `sessions.ts:16-24` | Reference patterns for MCP data layer |
| Filter logic | `app/src/lib/supabase/issues.ts:329+`, `sessions.ts:167+` | Reference patterns (replicate without `cache()` wrapper) |

## New Dependencies

```
@modelcontextprotocol/server    # McpServer class, tool registration
@modelcontextprotocol/node      # NodeStreamableHTTPServerTransport
```

## npm Scripts

Add to `app/package.json`:
```json
"mcp:server": "tsx --tsconfig tsconfig.mcp.json src/mcp/server.ts",
"mcp:dev": "tsx watch --tsconfig tsconfig.mcp.json src/mcp/server.ts"
```

Default port: `3100` (configurable via `MCP_PORT` env var).

## Implementation Steps

### Step 1: Setup
- Install `@modelcontextprotocol/server` and `@modelcontextprotocol/node`
- Create `app/tsconfig.mcp.json` extending base tsconfig
- Add npm scripts to `package.json`
- Verify `tsx` resolves `@/*` path aliases

### Step 2: Core infrastructure
- `app/src/mcp/context.ts` — `McpContext` union type (admin | contact) + `AsyncLocalStorage` helpers
- `app/src/mcp/auth.ts` — `authenticateRequest(req)` resolves API key + optional JWT -> returns `McpContext`
  - Fetches `project.secret_key` to verify JWT
  - Resolves contact from `userMetadata.email` in the JWT payload

### Step 3: Data layer
- `app/src/mcp/data/index.ts` — shared helpers
- `app/src/mcp/data/issues.ts` — issue queries (full project + contact-scoped variants)
- `app/src/mcp/data/sessions.ts` — session/message queries (full project + contact-scoped)
- `app/src/mcp/data/contacts.ts` — contact queries

### Step 4: Tool definitions
- `app/src/mcp/tools/admin/*.ts` — 7 admin tools
- `app/src/mcp/tools/contact/*.ts` — 4 contact tools
- `app/src/mcp/tools/index.ts` — `registerAdminTools(server)` + `registerContactTools(server)`

### Step 5: Server entry point
- `app/src/mcp/server.ts` — HTTP server with:
  - Auth middleware that determines mode (admin vs contact)
  - Creates the appropriate McpServer with the correct toolset
  - Body parsing, MCP transport wiring
  - Health check at `GET /health`
  - MCP endpoint at `POST /mcp`

### Step 6: Testing
- Unit tests for auth (API key only, API key + valid JWT, API key + invalid JWT, missing auth)
- Unit tests for each tool's data scoping
- Integration test: full HTTP flow with both modes
- Manual test with Claude Desktop

## Verification

1. **Start server**: `cd app && npm run mcp:dev`
2. **Health check**: `curl http://localhost:3100/health` -> `{"status":"ok"}`
3. **Auth rejection**: `curl -X POST http://localhost:3100/mcp` -> 401
4. **Admin tools**: API key only -> `tools/list` returns 7 admin tools
5. **Contact tools**: API key + contact JWT -> `tools/list` returns 4 contact tools
6. **Admin execution**: `list_issues` returns all project issues
7. **Contact execution**: `my_issues` returns only the contact's issues
8. **Contact isolation**: Contact mode has no way to access other contacts' data (no tools for it)
9. **Claude Desktop**: Configure MCP client, verify tool discovery and execution
