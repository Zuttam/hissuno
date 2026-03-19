# HubSpot Integration - Pull Customer Data

## Context

HubSpot is already listed as "Coming Soon" in the integrations page. This plan implements the full integration to sync companies and contacts from HubSpot CRM into Hissuno's existing customer data model. Unlike Intercom/Zendesk/Gong (which sync conversations into `sessions`), HubSpot syncs directly into the `companies` and `contacts` tables. HubSpot also requires OAuth token refresh (tokens expire every ~30 min), which is new compared to existing integrations.

Uses raw `fetch` (not `@hubspot/api-client`) to stay consistent with all other integrations.

## Implementation Plan

### Step 1: Database Schema

**File: `app/src/lib/db/schema/app.ts`** - Add 3 tables after the PostHog section (~line 937):

**`hubspot_connections`**: `id`, `project_id` (unique FK), `hub_id` (text), `hub_name` (text), `access_token`, `refresh_token`, `token_expires_at` (timestamp), `auth_method` (default 'oauth'), `sync_enabled`, `sync_frequency` (default 'manual'), `filter_config` (jsonb), `last_sync_at`, `last_sync_status`, `last_sync_error`, `last_sync_companies_count`, `last_sync_contacts_count`, `next_sync_at`, `created_at`, `updated_at`

**`hubspot_sync_runs`**: `id`, `connection_id` (FK), `status`, `triggered_by`, `companies_found`, `companies_synced`, `companies_updated`, `contacts_found`, `contacts_synced`, `contacts_updated`, `error_message`, `started_at`, `completed_at`

**`hubspot_synced_records`**: `id`, `connection_id` (FK), `hubspot_object_type` ('company'|'contact'), `hubspot_object_id`, `hissuno_record_id` (uuid), `hubspot_updated_at`, `synced_at`

**File: `app/src/lib/db/schema/relations.ts`** - Add HubSpot relation definitions + project relation

### Step 2: OAuth Layer

**New file: `app/src/lib/integrations/hubspot/oauth.ts`**
- `getHubSpotOAuthUrl()` - Auth URL with scopes: `crm.objects.contacts.read crm.objects.companies.read`
- `exchangeHubSpotOAuthCode()` - Returns `{ accessToken, refreshToken, expiresIn }`
- `refreshHubSpotToken()` - Token refresh (HubSpot rotates refresh token on each call)

### Step 3: API Client

**New file: `app/src/lib/integrations/hubspot/client.ts`**
- `HubSpotClient` class with `request()` method (rate limit retry on 429)
- `testConnection()` - `GET /account-info/v3/details`
- `listCompanies()` / `listContacts()` - Async generators with cursor pagination
- For incremental sync: `POST /crm/v3/objects/{type}/search` with `lastmodifieddate GTE` filter
- `getContactCompanyAssociations()` - Resolve contact-company links

Company properties to fetch: `name, domain, industry, country, numberofemployees, annualrevenue, description, lifecyclestage, type`
Contact properties: `firstname, lastname, email, phone, jobtitle, company, lifecyclestage, associatedcompanyid`

### Step 4: Service Layer

**New file: `app/src/lib/integrations/hubspot/index.ts`** (follows `intercom/index.ts` pattern)
- `getHubSpotCredentials()` - Auto-refreshes token if within 5 min of expiry
- `storeHubSpotCredentials()`, `disconnectHubSpot()`, `updateHubSpotSettings()`
- Sync run management: `createSyncRun()`, `completeSyncRun()`
- Dedup helpers: `isRecordSynced()`, `recordSyncedRecord()`
- `getConnectionsDueForSync()` - For cron

### Step 5: Sync Engine

**New file: `app/src/lib/integrations/hubspot/sync.ts`**

Sync order: companies first (so contacts can link to them), then contacts.

**Field mappings:**

| HubSpot | Hissuno Company |
|---------|----------------|
| `name` | `name` |
| `domain` | `domain` |
| `industry` | `industry` |
| `country` | `country` |
| `numberofemployees` | `employee_count` |
| `annualrevenue` | `arr` |
| `lifecyclestage` | `stage` |
| `description` | `notes` |

| HubSpot | Hissuno Contact |
|---------|----------------|
| `firstname + lastname` | `name` |
| `email` | `email` |
| `phone` | `phone` |
| `jobtitle` | `title` |
| `associatedcompanyid` | `company_id` (via synced records lookup) |

Dedup strategy: Companies by domain, contacts by email. Falls back to creating new records when no match.

### Step 6: API Routes

All under `app/src/app/api/(project)/integrations/hubspot/`:

- **`route.ts`** - GET status, PATCH settings, DELETE disconnect
- **`connect/route.ts`** - GET initiates OAuth redirect
- **`callback/route.ts`** - GET handles OAuth callback, stores tokens
- **`sync/route.ts`** - GET triggers manual sync with SSE progress

### Step 7: Cron Job

**New file: `app/src/app/api/(system)/cron/hubspot-sync/route.ts`** - Processes connections due for sync

### Step 8: UI

**New file: `app/src/components/projects/integrations/hubspot-config-dialog.tsx`**
- Connected state: portal name, sync stats (companies + contacts counts), frequency selector, manual sync with progress, disconnect
- Not connected: "Connect with HubSpot" OAuth button

**Modify: `app/src/app/(authenticated)/projects/[id]/integrations/page.tsx`**
- Remove `comingSoon: true` from HubSpot entry (line 504)
- Add `hubspotConnected` state + status fetching
- Wire up config dialog

**Modify: `app/src/components/projects/integrations/index.ts`** - Export dialog

### Step 9: Integration Availability

**Modify: `app/src/app/api/(system)/integrations/availability/route.ts`** - Add HubSpot with `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET`

### Step 10: Migration

Run `npx drizzle-kit generate` and `npx drizzle-kit push`

## Environment Variables

```
HUBSPOT_CLIENT_ID=       # HubSpot developer portal
HUBSPOT_CLIENT_SECRET=   # HubSpot developer portal
```

## Files Summary

**New (10):**
1. `app/src/lib/integrations/hubspot/oauth.ts`
2. `app/src/lib/integrations/hubspot/client.ts`
3. `app/src/lib/integrations/hubspot/index.ts`
4. `app/src/lib/integrations/hubspot/sync.ts`
5. `app/src/app/api/(project)/integrations/hubspot/route.ts`
6. `app/src/app/api/(project)/integrations/hubspot/connect/route.ts`
7. `app/src/app/api/(project)/integrations/hubspot/callback/route.ts`
8. `app/src/app/api/(project)/integrations/hubspot/sync/route.ts`
9. `app/src/app/api/(system)/cron/hubspot-sync/route.ts`
10. `app/src/components/projects/integrations/hubspot-config-dialog.tsx`

**Modified (5):**
1. `app/src/lib/db/schema/app.ts` - 3 new tables
2. `app/src/lib/db/schema/relations.ts` - HubSpot relations
3. `app/src/app/(authenticated)/projects/[id]/integrations/page.tsx` - Enable HubSpot
4. `app/src/components/projects/integrations/index.ts` - Export dialog
5. `app/src/app/api/(system)/integrations/availability/route.ts` - Add availability check

## Key Reference Files

- `app/src/lib/integrations/intercom/` - Primary pattern to follow
- `app/src/lib/db/schema/app.ts:768-818` - Intercom table patterns
- `app/src/lib/db/queries/companies.ts` - Existing company query functions to reuse
- `app/src/lib/db/queries/contacts.ts` - Existing contact query functions to reuse
- `app/src/lib/sse/index.ts` - SSE streaming for sync progress

## Verification

1. Set `HUBSPOT_CLIENT_ID` and `HUBSPOT_CLIENT_SECRET` env vars
2. Run migration: `npx drizzle-kit generate && npx drizzle-kit push`
3. Start dev server, navigate to integrations page - HubSpot should show as connectable (not "Coming Soon")
4. Click Configure -> Connect with HubSpot -> complete OAuth flow
5. Verify connection status shows portal name
6. Trigger manual sync -> verify companies and contacts appear in Hissuno
7. Verify incremental sync only fetches updated records
8. Test disconnect flow clears connection and synced record mappings
