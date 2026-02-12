---
status: pending
created: 2026-02-11
impact: high
summary: Link sessions to contacts via email matching, surface customer impact on issues
---

# Connect Issues to Source Customers

## Context

The customers module (contacts/companies) was just added but lives in isolation. Sessions carry user data (`user_metadata.email`) but aren't linked to contacts. Issues are created from sessions but have no customer context. The goal: **when viewing an issue, see which customers reported it** -- and from the customer side, see all their sessions and issues.

The primary matching key is **email** (unique per project on contacts, available in `user_metadata` from widget/Intercom/Gong/Slack sources).

---

## Approach

### 1. Add `contact_id` FK on `sessions` table

**Why sessions, not issues?** One issue has many sessions (via `issue_sessions`). Each session belongs to one contact. Issues inherit customer context through their linked sessions -- this is the correct relational path because one issue can involve multiple contacts from different companies.

```
Issue -> issue_sessions -> Session (contact_id) -> Contact (company_id) -> Company
```

**Migration:**
```sql
ALTER TABLE public.sessions
  ADD COLUMN contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;

CREATE INDEX sessions_contact_id_idx ON public.sessions(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX sessions_project_contact_idx ON public.sessions(project_id, contact_id) WHERE contact_id IS NOT NULL;
```

`ON DELETE SET NULL` -- if a contact is deleted, sessions remain but lose the link.

### 2. Contact resolution service (new file)

**New file: `app/src/lib/customers/contact-resolution.ts`**

Core function: `resolveContactForSession({ projectId, userMetadata, sessionId })`

Logic:
1. Extract email from `userMetadata.email` (or `userMetadata.Email`, case-insensitive key lookup)
2. Normalize: `email.toLowerCase().trim()`, validate format
3. Look up `contacts` by `(project_id, email)`
4. **If found**: update `last_contacted_at`, set `sessions.contact_id`
5. **If not found**: auto-create contact with available metadata (name, phone, role from `userMetadata`), then set `sessions.contact_id`
6. **Company resolution**: extract domain from email, skip generic domains (gmail, yahoo, etc.), look up existing company by `(project_id, domain)`, link if found. Do NOT auto-create companies (they need real business data like ARR/stage).
7. **If no email**: skip silently, session stays anonymous

Fallback for name when creating: `userMetadata.name ?? email.split('@')[0]` (capitalize first letter).

### 3. Insert into session review workflow

**Modify: `app/src/mastra/workflows/session-review/index.ts`**

Add `resolveContact` step between `preparePMContext` (step 3) and `findDuplicates` (step 4):

```
prepareCodebase -> classifySession -> preparePMContext -> resolveContact -> findDuplicates -> ...
```

**New file: `app/src/mastra/workflows/session-review/steps/resolve-contact.ts`**

This is a **deterministic step** (no AI calls). It reads `session.userMetadata` from the workflow context and calls `resolveContactForSession()`. Adds ~10-30ms per review (one DB read + possibly one write). Zero AI cost.

**Why at review time, not session creation?**
- Session creation is the hot path (widget POST must be fast)
- Many sessions are anonymous -- no point attempting resolution
- The review workflow already runs async after session close
- Contacts are only auto-created from sessions that produce meaningful feedback

### 4. Update queries to join contact/company data

**Modify: `app/src/lib/supabase/sessions.ts`**
- Update session select strings to include: `contact:contacts(id, name, email, company:companies(id, name, domain, arr, stage))`

**Modify: `app/src/lib/supabase/issues.ts`** (or wherever `getIssueById` lives)
- Update issue+sessions select to include contact data on each session

**Modify: `app/src/types/session.ts`**
- Add `contact_id: string | null` to `SessionRecord`
- Add `contact?: { id, name, email, company?: { id, name, domain, arr, stage } }` to `SessionWithProject`

**Modify: `app/src/types/issue.ts`**
- Add contact fields to session type within `IssueWithSessions`
- Add `IssueCustomerImpact` type: `{ contactCount, companyCount, totalARR, companies[] }`

### 5. UX changes (most important)

#### 5a. Issue sidebar -- "Customer Impact" section
**File: `app/src/components/issues/issue-sidebar.tsx`**

New `CollapsibleSection` between existing sections showing:
- Summary line: "3 contacts from 2 companies -- $45K ARR at risk"
- Compact company rows: `[Stage Badge] Company Name -- $ARR -- N contacts`
- Each company/contact clickable (navigates to their sidebar)
- If no identified customers: "No identified customers"
- Computed client-side from the joined session data (no new API endpoint)

#### 5b. Contact sidebar -- "Sessions" and "Issues" sections
**File: `app/src/components/customers/contact-sidebar.tsx`**

Two new `CollapsibleSection`s:
- **Sessions**: query `sessions WHERE contact_id = X`, show as compact list (source badge + name + date)
- **Issues**: query through `issue_sessions` join, show as compact list (type badge + title + status)

New query functions needed in `app/src/lib/supabase/contacts.ts`:
- `getContactLinkedSessions(contactId)`
- `getContactLinkedIssues(contactId)`

#### 5c. Company sidebar -- aggregate sessions/issues
**File: `app/src/components/customers/company-sidebar.tsx`**

Similar to contact sidebar but aggregated across all contacts in the company. Shows total sessions, total issues, unique contacts.

#### 5d. Session detail -- show linked contact
Update session header to display the matched contact name (clickable) and company badge. Falls back to existing `getSessionUserDisplay()` logic for anonymous sessions.

### 6. Regenerate Supabase types

```bash
cd app/supabase && supabase gen types typescript --local > ../src/types/supabase.ts
```

### 7. Backfill existing sessions

**New file: `app/src/scripts/backfill-session-contacts.ts`**

One-time script:
1. Query sessions where `user_metadata->>'email' IS NOT NULL AND contact_id IS NULL`
2. For each, call `resolveContactForSession()`
3. Batch of 100, log progress
4. Run via `npx tsx app/src/scripts/backfill-session-contacts.ts`

---

## Analysis by Perspective

### Architecture
- Single FK on sessions is clean -- no denormalization, no sync issues
- Issues get customer context through the natural join path
- `ON DELETE SET NULL` handles contact deletion gracefully
- Anonymous sessions handled naturally (nullable FK)

### Performance
- Partial index on `contact_id WHERE NOT NULL` keeps index small
- Composite `(project_id, contact_id)` covers the main query pattern
- No denormalization needed for v1 -- customer impact computed from joined data
- Future optimization: add `contact_count` column on issues if list view needs it

### Cost
- Zero AI cost -- contact resolution is pure DB lookup
- ~10-30ms added to review workflow (already takes 10-30s with AI calls)
- One read + possibly one write per review -- negligible

### UX
- Issue sidebar shows customer business impact (ARR at risk, company stages)
- Contact/company sidebars become the "customer 360" view with linked sessions and issues
- Anonymous sessions degraded gracefully -- no broken UI, just "Anonymous"
- Auto-created contacts can be enriched later (edit name, assign company, set as champion)

---

## Files to modify

| File | Change |
|------|--------|
| `app/supabase/migrations/NEW.sql` | Add `contact_id` FK + indexes |
| `app/src/lib/customers/contact-resolution.ts` | **New** -- matching + auto-create logic |
| `app/src/mastra/workflows/session-review/index.ts` | Insert `resolveContact` step |
| `app/src/mastra/workflows/session-review/steps/resolve-contact.ts` | **New** -- workflow step |
| `app/src/mastra/workflows/session-review/schemas.ts` | Add contact fields to output schemas |
| `app/src/lib/supabase/sessions.ts` | Join contact/company in select queries |
| `app/src/lib/supabase/contacts.ts` | Add `getContactLinkedSessions`, `getContactLinkedIssues` |
| `app/src/types/session.ts` | Add `contact_id`, contact type to SessionWithProject |
| `app/src/types/issue.ts` | Add `IssueCustomerImpact` type |
| `app/src/types/supabase.ts` | Regenerate |
| `app/src/components/issues/issue-sidebar.tsx` | Add "Customer Impact" section |
| `app/src/components/customers/contact-sidebar.tsx` | Add "Sessions" and "Issues" sections |
| `app/src/components/customers/company-sidebar.tsx` | Add aggregate sessions/issues sections |
| `app/src/hooks/use-contacts.ts` | Add linked sessions/issues fetching |
| `app/src/scripts/backfill-session-contacts.ts` | **New** -- one-time backfill |

---

## Verification

1. **Migration**: Run `supabase db push`, verify `contact_id` column exists on sessions
2. **Contact resolution**: Create a session via widget with `userMetadata.email` set, trigger session review, verify contact is auto-created and `sessions.contact_id` is set
3. **Existing contact match**: Create a contact manually, then submit feedback with same email -- verify it links to existing contact (not duplicated)
4. **Issue sidebar**: Open an issue linked to a session with a matched contact -- verify "Customer Impact" section shows contact + company + ARR
5. **Contact sidebar**: Open a contact -- verify linked sessions and issues appear
6. **Anonymous sessions**: Submit feedback without email -- verify no contact created, UI shows "Anonymous" gracefully
7. **Contact deletion**: Delete a contact -- verify sessions remain with `contact_id = NULL`
