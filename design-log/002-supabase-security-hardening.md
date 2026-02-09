# Design Log #002: Supabase Security Hardening

## Background
Security audit triggered by Roy Shasha's LinkedIn post about Moltbook's Supabase breach. The post identifies key vulnerabilities: disabled RLS, unrestricted function EXECUTE permissions, and SECURITY DEFINER functions bypassing RLS. We audited all 77 migrations and found issues that need fixing.

## Problem
Three critical security gaps:

1. **SECURITY DEFINER search functions bypass RLS** - `search_knowledge_embeddings` and `search_similar_issues` run as the table owner (postgres), bypassing all RLS policies. Any caller can query ANY project's data by passing an arbitrary `project_id` parameter.

2. **No REVOKE on functions** - PostgreSQL grants EXECUTE to PUBLIC by default. This means anon key holders can call functions like `search_knowledge_embeddings` via PostgREST's `/rpc/` endpoint, potentially leaking all knowledge data.

3. **No default privilege restrictions** - Any new function created in future migrations will automatically be callable by public/anon unless explicitly revoked.

## Design

### Proposed Solution

Single migration with three categories of fixes:

#### A. Set Default Privileges
Prevent future functions from being callable by public/anon:
```sql
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
```

#### B. Revoke EXECUTE on All Custom Functions
Revoke from PUBLIC, anon, and authenticated. Then grant back only to roles that need access:

| Function | Revoke From | Grant To | Reason |
|----------|-------------|----------|--------|
| `check_waitlist_rate_limit(text)` | PUBLIC, anon, authenticated | (none) | Only used inside INSERT policy (runs as table owner) |
| `search_knowledge_embeddings(...)` | PUBLIC, anon | authenticated, service_role | Switching to SECURITY INVOKER; RLS protects data |
| `search_similar_issues(...)` | PUBLIC, anon | (keep existing grants) | Switching to SECURITY INVOKER; RLS protects data |
| `generate_project_key(text, integer)` | PUBLIC, anon, authenticated | (none) | Only used by trigger |
| `auto_generate_project_keys()` | PUBLIC, anon, authenticated | (none) | Only used by trigger |
| `handle_updated_at()` | PUBLIC, anon, authenticated | (none) | Only used by trigger |

#### C. Switch Search Functions to SECURITY INVOKER
The critical fix. Both search functions currently use SECURITY DEFINER which bypasses RLS. Switching to SECURITY INVOKER means:
- RLS policies are enforced on the calling user
- Authenticated users can only search within their own projects (via existing RLS policies)
- service_role callers still bypass RLS (Supabase behavior), so backend operations are unaffected
- `SET search_path = public, extensions` remains so vector operators resolve correctly

### File Changes
- **Create**: `app/supabase/migrations/20260209100000_security_hardening_rls_functions.sql`

### What This Does NOT Change
- Waitlist table: RLS is already enabled, no SELECT policy = all reads blocked. This is correct behavior.
- Service role bypass policies on tables: These are necessary for backend agent operations (Mastra).
- Storage bucket policies: Already correctly scoped.

## Trade-offs

| Decision | Alternative | Why This Way |
|----------|-------------|--------------|
| SECURITY INVOKER for search functions | Keep DEFINER + add auth checks inside function | INVOKER is simpler, leverages existing RLS policies, recommended by Supabase docs |
| Revoke from trigger functions | Leave as-is (low risk since triggers aren't directly callable via /rpc/) | Defense in depth - follow the blog's recommendation to lock down everything |
| Don't add SELECT policy to waitlist | Add explicit SELECT deny | RLS enabled + no policy = denied by default. Adding a policy is redundant. |

---

## Implementation Results

### Migration Created
`app/supabase/migrations/20260209100000_security_hardening_rls_functions.sql`

### Deviations from Design
None. Implemented as designed.

### Summary
- Default privileges set to prevent future function exposure
- All 6 custom functions locked down with REVOKE
- Both search functions recreated with SECURITY INVOKER (was SECURITY DEFINER)
- Search functions granted to authenticated + service_role only
- Trigger/utility functions granted to no one (they work via trigger/policy context)
