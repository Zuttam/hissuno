# Architecture

Hissuno is a unified context layer for product agents. It builds an interconnected knowledge graph from your product data and exposes it through agent-native interfaces. This document covers authentication, proxy, the graph data model, and core architectural patterns.

## Terminology Mapping

The codebase uses internal names that differ from the user-facing UI labels:

| UI Label | Code Term | Where You'll See It |
|----------|-----------|---------------------|
| Feedback | `sessions` | DB tables, API routes (`/api/sessions`), types, components, hooks |
| Roadmap Items | `issues` | DB tables, API routes (`/api/issues`), types, components, hooks |

When reading or writing code, use the code terms (`sessions`, `issues`). The UI layer translates these to user-facing labels.

## Authentication & Proxy (Next.js 16)

Next.js 16 uses `proxy.ts` (not `middleware.ts`) for request interception. Our proxy (`src/proxy.ts`) is the **sole trust boundary** for authentication:

1. Validates sessions via AuthJS `auth()` or API keys via hash lookup
2. Injects identity headers (`x-user-id`, `x-user-email`, `x-user-name`, `x-api-key-id`, etc.)
3. **Strips all identity headers** when no valid credentials are present - prevents header forgery
4. Downstream code (`resolveRequestIdentity`) trusts these proxy-injected headers - it does NO database calls
5. All data queries use Drizzle ORM with `db` singleton (application-level access control, no RLS)

**Security invariant**: Identity headers are ONLY trustworthy because the proxy strips/rewrites them on every request. Never read these headers outside of `resolveRequestIdentity()`, and never set them outside of `proxy.ts`.

## AuthJS v5 (next-auth)

Config lives in `src/lib/auth/auth.ts`. Key patterns:

### Error Handling

AuthJS v5 errors extend `AuthError` from `next-auth`. Always use `error.type` (not `error.message`) to identify error kinds:

```typescript
import { AuthError } from 'next-auth'

try {
  await signIn('credentials', { email, password, redirect: false })
} catch (error) {
  if (error instanceof AuthError) {
    switch (error.type) {
      case 'CredentialsSignin':
        return { error: 'Invalid email or password.' }
      case 'AccessDenied':
        return { error: 'Access denied.' }
      default:
        return { error: 'Something went wrong.' }
    }
  }
  throw error // Re-throw non-auth errors (including Next.js redirects)
}
```

**Key error types**: `CredentialsSignin`, `AccessDenied`, `Configuration`, `Verification`, `CallbackRouteError`, `AccountNotLinked`.

### Custom Credential Errors

Extend `CredentialsSignin` to pass custom error codes:

```typescript
import { CredentialsSignin } from 'next-auth'

class InvalidLoginError extends CredentialsSignin {
  code = 'Invalid identifier or password'
}
// Throw from authorize() - code appears in redirect URL as ?error=<code>
```

### JWT Callbacks

With `session: { strategy: 'jwt' }`, use callbacks to attach user data to the token/session:

```typescript
callbacks: {
  jwt({ token, user }) {
    if (user) token.id = user.id  // user only present on sign-in
    return token
  },
  session({ session, token }) {
    if (session.user && token.id) session.user.id = token.id as string
    return session
  },
}
```

### Server-Side Session

Use `auth()` (exported from auth config) to get session in Server Components and API routes. With JWT strategy, `auth()` reads/verifies the JWT cookie - no DB call.

**Important**: When using `signIn()` with `redirect: false` in Server Actions, AuthJS still throws on failure (it does NOT return an error object). Always wrap in try/catch.

## Never Make Internal HTTP Calls

API routes must never call other API routes via fetch. Import service functions directly:

```typescript
// BAD
await fetch(`${process.env.NEXT_PUBLIC_URL}/api/other-route`)

// GOOD
import { doSomething } from '@/lib/some-service'
await doSomething({ projectId, userId })
```

## Knowledge Graph

The core of Hissuno is a traversable knowledge graph. All entity-to-entity connections are stored in a single `entity_relationships` table, forming an interconnected graph that agents can traverse to build context from any starting point.

### Graph Design

The table uses a **wide table with nullable FK columns** pattern. Each row represents exactly one edge in the knowledge graph, with exactly two non-null entity FK columns identifying the connected pair. This design lets agents traverse from any entity to any connected entity in a single query:

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `project_id` | uuid | Scoping - every relationship belongs to a project |
| `session_id` | uuid (nullable) | FK to `sessions` |
| `issue_id` | uuid (nullable) | FK to `issues` |
| `contact_id` | uuid (nullable) | FK to `contacts` |
| `product_scope_id` | uuid (nullable) | FK to `product_scopes` |
| `knowledge_source_id` | uuid (nullable) | FK to `knowledge_sources` |
| `created_at` | timestamp | When the relationship was created |

**Invariant**: Each row has exactly 2 non-null entity FK columns (plus `project_id`, `id`, and `created_at`). A row with `session_id` and `contact_id` set means "this session is linked to this contact."

### Terminology mapping

| UI / domain term | Code / DB term |
|------------------|----------------|
| Knowledge | `knowledgeSources` / `knowledge_sources` |
| Products | `productScopes` / `product_scopes` |
| Feedback | `sessions` |
| Roadmap Items | `issues` |

### Cascade behavior

All entity FK columns use `ON DELETE CASCADE`. When any referenced entity is deleted, its relationship rows are automatically removed - no orphan cleanup needed.

### API pattern

All entity connections are managed through a single generic endpoint:

```
GET    /api/relationships?entityType=session&entityId=<id>    # list connections
POST   /api/relationships                                      # create a connection
DELETE /api/relationships/:id                                  # remove a connection
```

The API accepts entity type/ID pairs and creates or removes rows in `entity_relationships`. This replaces entity-specific join tables and foreign keys with a uniform interface.

### Migration from legacy FKs

Existing foreign key columns (`sessions.contact_id`, `sessions.product_scope_id`, `issues.product_scope_id`, `knowledge_sources.product_scope_id`) and the `issue_sessions` junction table have been migrated into `entity_relationships`. The migration script at `app/src/scripts/migrate-relationships.ts` handles this backfill and is safe to run multiple times (uses `ON CONFLICT DO NOTHING`).
