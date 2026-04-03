# Agent Identity

## Context

Users launch AI agents in Claude Code, Cursor, or similar tools that interact with Hissuno via MCP or REST API. Each agent should be a trackable identity: "User X's Cursor agent accessed Resource Z". Today, agents authenticate with generic API keys - there's no way to distinguish which agent made a call.

An agent is an ephemeral member of a project - not a separate concept. It shows up alongside human members, has a role, and gets its own project-scoped API key.

Depends on: [Audit Trail](audit-trail.md) - agent actions flow into the audit events table.

### Why Not DCR or CIMD?

- **DCR (Dynamic Client Registration, RFC 7591)** - agents self-register as OAuth clients. Demoted to optional in MCP spec (Nov 2025). Requires runtime registration - not practical for Claude/Cursor agents, which are ephemeral IDE sessions.

- **CIMD (Client ID Metadata Document, IETF draft)** - the agent's `client_id` is an HTTPS URL hosting metadata. MCP spec's recommended default. **Not viable** - Claude/Cursor agents don't have a web presence or domain to host metadata at.

**Both solve the wrong problem.** They're for autonomous agents that independently register with authorization servers. Hissuno's agents are user-dispatched ephemeral members - the user creates the identity and configures their tool with the key.

**When to revisit:** If Hissuno opens a public MCP server for third-party agents the user doesn't directly control. CIMD (backed by Auth0 for AI Agents or similar) would be the right choice then.

### Chosen approach: Agent Members + API Key Identity

Extend `project_members` with a member type. Agent members get a linked API key that carries their identity through every request. No new tables - just new columns on existing ones.

---

## User Experience

### Setup (one-time per agent per project)

```bash
$ hissuno members add-agent cursor-feedback-bot

Agent member 'cursor-feedback-bot' added to project.
API Key: hiss_a1b2c3d4...

Add to your MCP configuration:
  "hissuno": {
    "url": "https://app.hissuno.com/api/mcp",
    "headers": {
      "Authorization": "Bearer hiss_a1b2c3d4..."
    }
  }
```

### Management

```bash
hissuno members                         # list all members (humans + agents)
hissuno members add-agent <name>        # add agent member + issue key
hissuno members rotate-agent <name>     # revoke old key, issue new one
hissuno members remove <id>             # works for both humans and agents
```

### Members list output

```
Name                    Type    Role     Status   Last Active
Alice Smith             user    owner    active   2 hours ago
Bob Jones               user    member   active   1 day ago
cursor-feedback-bot     agent   member   active   5 min ago
claude-research-agent   agent   member   active   1 hour ago
```

### Audit trail

```
cursor-feedback-bot    listed 24 contacts           2 min ago
cursor-feedback-bot    created issue "Login bug"     5 min ago
claude-research-agent  searched 12 sessions          1 hour ago
```

---

## Design

### Extend `project_members`

Add columns:
```
member_type     text DEFAULT 'user'    -- 'user' | 'agent'
agent_name      text                   -- only for agent members; validated: /^[a-zA-Z0-9_-]+$/, max 64
```

For agent members:
- `user_id` = the creating user (owner of the agent)
- `member_type` = 'agent'
- `agent_name` = e.g. 'cursor-feedback-bot'
- `role` = assigned role (default 'member')
- `status` = 'active'
- `invited_by_user_id` = the creating user

Unique constraint: `(project_id, agent_name)` WHERE `agent_name IS NOT NULL` - one agent per name per project.

### Extend `project_api_keys`

Add column:
```
agent_member_id     uuid FK -> project_members   -- nullable; links key to agent member
```

- Keys without `agent_member_id` = regular API keys (unchanged)
- Keys with `agent_member_id` = agent keys (carry agent identity)
- When an agent member is removed, its linked keys are revoked

### Identity Variant

Extend `RequestIdentity`:

```typescript
export type RequestIdentity =
  | { type: 'user'; userId: string; email: string | null; name: string | null }
  | { type: 'agent'; projectId: string; keyId: string; createdByUserId: string; agentName: string }
  | { type: 'api_key'; projectId: string; keyId: string; createdByUserId: string }
```

The `agent` type is like `api_key` but with `agentName` attached. Resolved from the same `hiss_*` token - the distinction is whether the key has a linked agent member.

Helper:
```typescript
export function getActingUserId(identity: RequestIdentity): string {
  switch (identity.type) {
    case 'user': return identity.userId
    case 'agent': return identity.createdByUserId
    case 'api_key': return identity.createdByUserId
  }
}
```

### Authorization

- Agent identity inherits the creating user's project role via existing `assertProjectAccess()` - same as regular API keys
- `requireUserIdentity()` still rejects agents (profile management only)
- No new RBAC needed

### Audit Integration

When an agent acts, audit events record:
```json
{
  "actor_type": "agent",
  "actor_id": "<api-key-id>",
  "actor_user_id": "<creating-user-uuid>",
  "metadata": { "agent_name": "cursor-feedback-bot" }
}
```

---

## Implementation

### 1. Schema (`app/src/lib/db/schema/app.ts`)

- Add `member_type` and `agent_name` columns to `projectMembers`
- Add `agent_member_id` nullable FK column to `projectApiKeys`

### 2. API Key Resolution (`app/src/lib/auth/api-keys.ts`)

- Update `resolveApiKey()` query: left join `project_members` via `agent_member_id`, return `agentName` if present
- Return type: `{ keyId, projectId, createdByUserId, agentName: string | null }`

### 3. Identity Types (`app/src/lib/auth/identity.ts`)

- Add `'agent'` variant to `RequestIdentity` union
- Add header constant: `AGENT_NAME_HEADER = 'x-agent-name'`
- Update `resolveRequestIdentity()`: if API key headers + agent name header present, return `type: 'agent'`
- Add `getActingUserId()` helper

### 4. Proxy (`app/src/proxy.ts`)

- Add `x-agent-name` to `ALL_IDENTITY_HEADERS` (stripped on every request)
- In `hiss_*` API key resolution path: if `resolveApiKey()` returns `agentName`, inject `x-agent-name` header

### 5. MCP Server Auth (`app/src/mcp/auth.ts`)

- `resolveApiKey()` already returns the agent info after step 2
- Extend `McpContext` in `context.ts` with optional `agentName`
- Set `ctx.agentName` when the API key has a linked agent member

### 6. Authorization (`app/src/lib/auth/authorization.ts`)

- `assertProjectAccess()`: handle `'agent'` type same as `'api_key'` (uses `createdByUserId` for role check)

### 7. Member Management (`app/src/lib/auth/project-members.ts`)

New functions:
- `addAgentMember(projectId, createdByUserId, agentName)` - creates member + API key, returns key
- `rotateAgentKey(projectId, agentName)` - revokes old key, creates new one
- `removeAgentMember(projectId, agentName)` - removes member + revokes linked keys

Update existing:
- `listProjectMembers()` - include `member_type` and `agent_name` in results

### 8. API Endpoints

Extend existing members routes:

```
POST /api/members          - add { type: 'agent', agentName: '...' } alongside existing invite flow
GET  /api/members          - already lists all; now includes agent members
DELETE /api/members/:id    - already works; also revokes linked agent keys
POST /api/members/:id/rotate-key  - new; rotates agent member's API key
```

### 9. CLI (`app/packages/cli/src/commands/members.ts`)

Add subcommands:
- `hissuno members add-agent <name>` - POST to members with agent type, display key + MCP config snippet
- `hissuno members rotate-agent <name>` - POST to rotate-key endpoint
- Update list display to show member_type column

### 10. Consumer Updates (~15 route files)

Replace inline ternaries with `getActingUserId(identity)`.

### 11. Audit Utility Update (`app/src/lib/audit/audit.ts`)

- Add `'agent'` to the `actor_type` union
- Resolve from identity: `actor_type: 'agent'`, `actor_id: keyId`, metadata includes `agent_name`

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `app/src/lib/db/schema/app.ts` | Add columns to `projectMembers` + `projectApiKeys` |
| `app/src/lib/db/schema/relations.ts` | Add agent member -> API key relation |
| `app/src/lib/auth/api-keys.ts` | `resolveApiKey()` returns `agentName` |
| `app/src/lib/auth/identity.ts` | New `'agent'` variant, header, `getActingUserId()` |
| `app/src/lib/auth/authorization.ts` | Handle `'agent'` type |
| `app/src/lib/auth/project-members.ts` | `addAgentMember()`, `rotateAgentKey()`, update list |
| `app/src/proxy.ts` | Strip + inject `x-agent-name` header |
| `app/src/mcp/auth.ts` | Pass agentName to MCP context |
| `app/src/mcp/context.ts` | Add `agentName` to McpContext |
| `app/src/app/api/(project)/members/route.ts` | Handle agent member creation in POST |
| `app/src/app/api/(project)/members/[memberId]/route.ts` | Revoke linked keys on DELETE |
| `app/src/app/api/(project)/members/[memberId]/rotate-key/route.ts` | **New** - rotate agent key |
| `app/packages/cli/src/commands/members.ts` | Add `add-agent`, `rotate-agent` subcommands |
| `app/src/lib/audit/audit.ts` | Add `'agent'` actor type |
| ~15 route files | Replace ternaries with `getActingUserId()` |

## Verification

1. `hissuno members add-agent my-bot` -> get API key + MCP config snippet
2. Configure MCP with agent key -> MCP tools work, `McpContext.agentName` is set
3. Use agent key on REST API -> identity resolves as `type: 'agent'` with `agentName`
4. `hissuno members` -> lists agent alongside human members
5. Audit event shows `actor_type: 'agent'`, `metadata.agent_name: 'my-bot'`
6. `hissuno members rotate-agent my-bot` -> old key rejected, new key works
7. Remove agent member -> linked API keys revoked, auth fails
8. Spoofed `x-agent-name` header -> stripped by proxy
9. Agent key on `requireUserIdentity()` endpoint -> 403
10. Run existing auth + member tests for regression
