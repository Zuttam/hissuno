# Plan: Programmatic API Access with Bearer Token Authentication

## Overview

Add support for `Authorization: Bearer sk_live_xxx` to allow programmatic session and issue creation via API.

**Current state:** Secret keys exist (`sk_live_xxx`) but are only used for widget JWT signing.
**Goal:** Enable `POST /api/sessions` and `POST /api/issues` with Bearer token auth.

---

## Files to Create/Modify

### 1. NEW: `app/src/lib/auth/api-auth.ts`

Unified auth utility that tries Bearer token first, falls back to Supabase session.

```typescript
export type ApiAuthContext =
  | { type: 'bearer'; project: ProjectWithKeys; supabase: SupabaseClient }
  | { type: 'session'; user: { id: string; email: string | null }; supabase: SupabaseClient }

export class InvalidApiKeyError extends Error { status = 401 }

export async function resolveApiAuth(request: NextRequest): Promise<ApiAuthContext>
export async function assertProjectAccess(context: ApiAuthContext, projectId: string): Promise<void>
```

**Key logic:**
- Extract Bearer token from `Authorization` header
- Validate format with `validateSecretKey()` from `lib/projects/keys.ts`
- Look up project with `getProjectBySecretKey()` (uses admin client)
- Fall back to Supabase session auth if no Bearer token

---

### 2. MODIFY: `app/src/app/api/sessions/route.ts`

**Changes:**
- Replace direct Supabase auth with `resolveApiAuth(request)`
- Add `handleApiSessionCreate()` for Bearer auth (uses `source: 'api'`)
- Keep existing `handleDashboardSessionCreate()` for session auth
- Add input validation for API requests

**API Format (Bearer auth):**
```http
POST /api/sessions
Authorization: Bearer sk_live_xxx
Content-Type: application/json

{
  "user_id": "customer-123",
  "user_metadata": { "email": "..." },
  "page_url": "https://...",
  "page_title": "...",
  "tags": ["feature_request"],
  "messages": [{ "role": "user", "content": "..." }]
}
```

**Response:** `201` with `{ session: { id, source: 'api', ... } }`

**GET also updated:** Requires `projectId` param for Bearer auth, validates key matches project.

---

### 3. MODIFY: `app/src/app/api/issues/route.ts`

**Changes:**
- Replace direct Supabase auth with `resolveApiAuth(request)`
- Add `handleApiIssueCreate()` for Bearer auth
- Keep existing dashboard behavior
- Add input validation

**API Format (Bearer auth):**
```http
POST /api/issues
Authorization: Bearer sk_live_xxx
Content-Type: application/json

{
  "type": "feature_request",
  "title": "Add CSV export",
  "description": "...",
  "priority": "medium",
  "session_ids": ["api-123-abc"]
}
```

---

## Validation Rules

| Field | Max Length | Required |
|-------|------------|----------|
| user_id | 255 chars | No |
| page_url | 2048 chars | No |
| page_title | 200 chars | No |
| title (issue) | 200 chars | Yes |
| description | 5000 chars | Yes |
| messages | 100 items, 10k chars each | No |

**Valid tags:** `general_feedback`, `wins`, `losses`, `bug`, `feature_request`, `change_request`
**Valid issue types:** `bug`, `feature_request`, `change_request`
**Valid priorities:** `low`, `medium`, `high`

---

## Error Responses

| Status | Condition |
|--------|-----------|
| 400 | Validation error (missing field, invalid enum, etc.) |
| 401 | No auth, invalid key format, or key not found |
| 403 | Key valid but accessing wrong project |
| 500 | Server error |

---

## Implementation Steps

1. **Create `lib/auth/api-auth.ts`**
   - `extractBearerToken()` - parse Authorization header
   - `resolveApiAuth()` - unified auth resolver
   - `assertProjectAccess()` - verify project access
   - `InvalidApiKeyError` class

2. **Update `api/sessions/route.ts`**
   - Import new auth utilities
   - Add validation functions
   - Split POST into `handleApiSessionCreate` / `handleDashboardSessionCreate`
   - Update GET to require projectId for Bearer auth

3. **Update `api/issues/route.ts`**
   - Same pattern as sessions

4. **Test manually**
   - Bearer auth creates session with `source: 'api'`
   - Invalid key returns 401
   - Wrong project returns 403
   - Dashboard still works (regression)

---

## Verification

```bash
# Test Bearer auth - create session
curl -X POST http://localhost:3000/api/sessions \
  -H "Authorization: Bearer sk_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "test-123", "messages": [{"role": "user", "content": "Hello"}]}'

# Should return 201 with source: 'api'

# Test invalid key
curl -X POST http://localhost:3000/api/sessions \
  -H "Authorization: Bearer sk_live_invalid" \
  -H "Content-Type: application/json" \
  -d '{}'

# Should return 401

# Test GET with projectId
curl "http://localhost:3000/api/sessions?projectId=YOUR_PROJECT_ID" \
  -H "Authorization: Bearer sk_live_YOUR_KEY"

# Should return sessions list
```

---

## Not in Scope (Phase 2)

- Rate limiting per API key
- Dedicated audit logging table
- API versioning (`/api/v1/`)
- Scoped permissions (read-only keys)
