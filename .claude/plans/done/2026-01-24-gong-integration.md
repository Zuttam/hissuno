# Gong Integration Implementation Plan

## Overview

Implement a Gong integration that allows users to sync their Gong call transcriptions into Hissuno sessions for analysis. This is an API-key-based integration (no OAuth) where users configure their Gong credentials, sync frequency, and optional filters.

Follows the same patterns established by the Intercom integration.

## Key Features

1. **API Key Configuration**: Users provide Gong access key + secret in integrations page
2. **Configurable Sync**: User-selectable frequency (manual, hourly, 6h, daily)
3. **Filtering**: Optional date range and user/team filters
4. **Session Creation**: Each Gong call becomes a Hissuno session with transcript as messages
5. **Duplicate Prevention**: Track synced calls to avoid re-importing

## Implementation Files

### 1. Database Migration

**File**: `app/supabase/migrations/YYYYMMDDHHMMSS_add_gong_integration.sql`

Creates three tables (matching Intercom pattern with RLS):
- `gong_connections`: 1:1 project mapping with credentials and sync config
- `gong_synced_calls`: Track individual synced calls to prevent duplicates
- `gong_sync_runs`: Sync run history for debugging

Key columns for `gong_connections`:
- `access_key`, `access_key_secret` (credentials - stored directly, matching Intercom pattern)
- `sync_frequency` ('manual' | '1h' | '6h' | '24h')
- `sync_enabled`, `filter_config` (JSON for date range filters)
- `last_sync_at`, `last_sync_status`, `last_sync_error`, `last_sync_conversations_count`, `next_sync_at`

Key columns for `gong_synced_calls`:
- `connection_id` (FK to gong_connections)
- `gong_call_id` (Gong's call ID)
- `session_id` (Hissuno session ID)
- Unique constraint on `(connection_id, gong_call_id)`

Key columns for `gong_sync_runs`:
- `connection_id`, `triggered_by` ('manual' | 'cron')
- `status` ('running' | 'completed' | 'failed')
- `calls_found`, `calls_synced`, `calls_skipped`
- `started_at`, `completed_at`, `error`

### 2. Service Layer

**File**: `app/src/lib/integrations/gong/index.ts`

Core functions (matching Intercom's `index.ts` pattern):
- `hasGongConnection(supabase, projectId)` - Check status, return connection info
- `getGongCredentials(supabase, projectId)` - Get access key + secret for API calls
- `storeGongCredentials(supabase, params)` - Save credentials after validation (upsert)
- `updateGongSettings(supabase, projectId, settings)` - Update sync frequency/enabled/filters
- `disconnectGong(supabase, projectId)` - Delete connection
- `isCallAlreadySynced(supabase, connectionId, callId)` - Check duplicate
- `recordSyncedCall(supabase, params)` - Record synced call with session ID
- `updateSyncState(supabase, projectId, state)` - Update sync progress/status
- `createSyncRun(supabase, connectionId, triggeredBy)` - Create audit record
- `completeSyncRun(supabase, runId, results)` - Finalize sync run with counts
- `getConnectionsDueForSync(supabase)` - Find connections where `next_sync_at <= now`
- `getSyncStats(supabase, projectId)` - Return total synced count and recent runs
- `calculateNextSyncTime(frequency)` - Compute next scheduled sync time

**File**: `app/src/lib/integrations/gong/client.ts`

Gong API client class:
- `testConnection()` - Verify credentials via a lightweight API call
- `listCalls(options)` - List calls with date range filter
- `getCallDetails(callId)` - Get call metadata with participants
- `getTranscripts(callIds)` - Get transcripts (POST endpoint)
- `listAllCalls(options)` - Async generator with pagination

Includes rate limit tracking and error classes (`GongApiError`, `GongRateLimitError`).

**File**: `app/src/lib/integrations/gong/sync.ts`

Sync service (two-pass approach, matching Intercom):
- `syncGongCalls(options)` - Main sync function with progress callback
  - **Pass 1 (Scan)**: Collect all call IDs, check which are already synced
  - **Pass 2 (Fetch)**: Get full call details + transcripts, create sessions
- `createSessionFromGongCall(supabase, params)` - Convert Gong call to Hissuno session

### 3. API Routes

**File**: `app/src/app/api/integrations/gong/route.ts`
- `GET` - Check connection status + sync stats
- `PATCH` - Update sync settings
- `DELETE` - Disconnect integration

**File**: `app/src/app/api/integrations/gong/connect/route.ts`
- `POST` - Validate and save API credentials (tests connection first, then stores)

**File**: `app/src/app/api/integrations/gong/test/route.ts`
- `POST` - Test credentials without storing (for pre-connect validation in UI)

**File**: `app/src/app/api/integrations/gong/sync/route.ts`
- `GET` - Trigger manual sync with SSE progress streaming
- Events: `connected`, `progress`, `synced`, `skipped`, `error`, `complete`

**File**: `app/src/app/api/cron/gong-sync/route.ts`
- `GET` - Cron endpoint for scheduled syncs
- Bearer token auth via `CRON_SECRET` env var
- Finds connections due for sync, processes sequentially
- Returns aggregate results

### 4. Cron Workflow

**File**: `.github/workflows/cron-gong-sync.yml`

GitHub Actions workflow (matching Intercom pattern):
- Schedule: Every hour at :30 (`30 * * * *`) - offset from Intercom's :15
- Calls `/api/cron/gong-sync` with bearer token
- Supports manual workflow dispatch

### 5. UI Components

**File**: `app/src/components/projects/edit-dialogs/gong-config-dialog.tsx`

Dialog component with two states (matching Intercom dialog pattern):

**Not Connected State:**
- Access key + secret inputs with password masking
- "Test" button to validate credentials before connecting
- Sync frequency selector (manual/1h/6h/24h)
- Optional date range filters (from/to dates)
- "Connect Gong" button

**Connected State:**
- Success alert with connection info
- **Sync Stats Section**: Total synced calls, last sync time/status, calls synced count
- **Settings Section**: Change sync frequency and date filters with save
- **Manual Sync Section**: Real-time progress bar via SSE, "Sync Now" button
- **Danger Zone**: Disconnect button with warning

Uses `EventSource` for SSE streaming from sync endpoint.

### 6. Integrations Page Update

**File**: `app/src/app/(authenticated)/projects/[id]/integrations/page.tsx`

Updates:
- Add `gongConnected` state
- Fetch Gong status in `fetchStatuses`
- Add `showGongDialog` state and handlers
- Remove `comingSoon: true` from Gong entry
- Render `GongConfigDialog`
- Support `?dialog=gong` URL parameter for direct opening

### 7. Assets

**File**: `app/public/logos/gong.svg`

Gong logo SVG (already exists based on GongIcon in page).

### 8. Configuration

**File**: `app/.env.example`

Add:
```
CRON_SECRET=           # Secret for cron endpoint auth (shared with Intercom)
```

## Gong API Details

- **Base URL**: `https://api.gong.io/v2/`
- **Auth**: Basic Auth with `access_key:access_secret` base64 encoded
- **Key Endpoints**:
  - `GET /v2/calls?fromDateTime=X&toDateTime=Y` - List calls
  - `GET /v2/calls/{id}` - Call details with participants
  - `POST /v2/calls/transcript` - Get transcripts (body: `{filter: {callIds: []}}`)
- **Rate Limits**: ~1000 req/hour, handle 429 with exponential backoff
- **Pagination**: Cursor-based (check `cursor` in response)

## Session Mapping

Each Gong call creates a session with:
- `source`: `'gong'`
- `status`: `'closed'` (historical calls)
- `name`: Call title or auto-generated from date
- `user_metadata`: Gong call ID, URL, duration, participants, direction, scope

Transcript entries become messages:
- **External participants (customers)** -> `sender_type: 'user'` with speaker label
- **Internal participants (your team)** -> `sender_type: 'human_agent'` with speaker label
- Content format: `[Speaker Name]: {transcript text}`
- Speaker names from Gong participant data (name or email)

Enrich user metadata from Gong participant data where available (name, email, title, company).

## Changes from Original Plan (Intercom Alignment)

1. **Removed crypto utility** - Store credentials directly like Intercom does (no separate encryption layer)
2. **Added test endpoint** - `test/route.ts` for pre-connect credential validation
3. **Two-pass sync** - Scan pass to check duplicates, then fetch pass for full details
4. **GitHub Actions cron** instead of `vercel.json` crons
5. **Added missing service functions** - `getSyncStats`, `calculateNextSyncTime`, `getConnectionsDueForSync`, `createSyncRun`, `completeSyncRun`
6. **Added DB columns** - `last_sync_error`, `last_sync_conversations_count` to match Intercom schema
7. **Enhanced UI** - Test button, sync stats display, URL parameter support (`?dialog=gong`)
8. **Removed `ENCRYPTION_KEY` env var** - No longer needed without crypto utility

## Verification Steps

1. Create a test project
2. Configure Gong integration with valid API keys
3. Test credentials validation (test endpoint)
4. Run manual sync and verify sessions are created with correct speaker mapping
5. Check duplicate prevention (re-sync should skip existing calls)
6. Test sync frequency settings update
7. Test disconnect removes all related data
8. Verify cron workflow triggers scheduled syncs

## File Summary

| File | Type | Description |
|------|------|-------------|
| `migrations/YYYYMMDDHHMMSS_add_gong_integration.sql` | Migration | DB schema (3 tables + RLS) |
| `lib/integrations/gong/index.ts` | Service | Core DB operations |
| `lib/integrations/gong/client.ts` | Service | Gong API client |
| `lib/integrations/gong/sync.ts` | Service | Two-pass sync logic |
| `api/integrations/gong/route.ts` | API | Status/settings/disconnect |
| `api/integrations/gong/connect/route.ts` | API | Save credentials |
| `api/integrations/gong/test/route.ts` | API | Test credentials |
| `api/integrations/gong/sync/route.ts` | API | Manual sync SSE |
| `api/cron/gong-sync/route.ts` | API | Scheduled sync cron |
| `.github/workflows/cron-gong-sync.yml` | Config | Cron schedule |
| `components/.../gong-config-dialog.tsx` | UI | Config dialog |
| `projects/[id]/integrations/page.tsx` | UI | Page updates |
| `.env.example` | Config | Env vars |
