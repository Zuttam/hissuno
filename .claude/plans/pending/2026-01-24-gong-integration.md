# Gong Integration Implementation Plan

## Overview

Implement a Gong integration that allows users to sync their Gong call transcriptions into Hissuno sessions for analysis. This is an API-key-based integration (no OAuth) where users configure their Gong credentials, sync frequency, and optional filters.

## Key Features

1. **API Key Configuration**: Users provide Gong access key + secret in integrations page
2. **Configurable Sync**: User-selectable frequency (manual, hourly, 6h, daily)
3. **Filtering**: Optional date range and user/team filters
4. **Session Creation**: Each Gong call becomes a Hissuno session with transcript as messages
5. **Duplicate Prevention**: Track synced calls to avoid re-importing

## Implementation Files

### 1. Database Migration

**File**: `app/supabase/migrations/YYYYMMDDHHMMSS_add_gong_integration.sql`

Creates three tables:
- `gong_connections`: 1:1 project mapping with credentials and sync config
- `gong_synced_calls`: Track individual synced calls to prevent duplicates
- `gong_sync_runs`: Sync run history for debugging

Key columns for `gong_connections`:
- `access_key`, `access_key_secret_encrypted` (credentials)
- `sync_frequency` ('manual' | '1h' | '6h' | '24h')
- `sync_enabled`, `filter_config` (JSON)
- `last_sync_at`, `last_sync_status`, `next_sync_at`

### 2. Crypto Utility (New)

**File**: `app/src/lib/crypto/index.ts`

Simple encryption utility using Node.js crypto with AES-256-GCM:
- `encrypt(text: string): Promise<string>` - Returns IV:authTag:ciphertext
- `decrypt(encrypted: string): Promise<string>` - Decrypts the above format

Uses `ENCRYPTION_KEY` env var (32-byte key, base64 encoded).

### 3. Service Layer

**File**: `app/src/lib/integrations/gong/index.ts`

Core functions:
- `hasGongConnection(supabase, projectId)` - Check status and return masked key
- `storeGongCredentials(supabase, params)` - Save encrypted credentials
- `updateGongSettings(supabase, projectId, settings)` - Update sync config
- `disconnectGong(supabase, projectId)` - Remove connection
- `getGongCredentials(supabase, projectId)` - Get decrypted credentials (internal use)
- `updateSyncState(supabase, projectId, state)` - Update sync status
- `isCallAlreadySynced(supabase, connectionId, callId)` - Check duplicate
- `recordSyncedCall(supabase, params)` - Record synced call

**File**: `app/src/lib/integrations/gong/client.ts`

Gong API client class:
- `testConnection()` - Verify credentials
- `listCalls(options)` - List calls with date range filter
- `getCallDetails(callId)` - Get call metadata with participants
- `getTranscripts(callIds)` - Get transcripts (POST endpoint)
- `listAllCalls(options)` - Async generator with pagination

Includes rate limit tracking and error classes (`GongApiError`, `GongRateLimitError`).

**File**: `app/src/lib/integrations/gong/sync.ts`

Sync service:
- `syncGongCalls(options)` - Main sync function with progress callback
- `createSessionFromGongCall(supabase, params)` - Convert Gong call to session

### 4. API Routes

**File**: `app/src/app/api/integrations/gong/route.ts`
- `GET` - Check connection status
- `PATCH` - Update sync settings
- `DELETE` - Disconnect integration

**File**: `app/src/app/api/integrations/gong/connect/route.ts`
- `POST` - Save API credentials (validates first)

**File**: `app/src/app/api/integrations/gong/sync/route.ts`
- `GET` - Trigger manual sync with SSE progress streaming

**File**: `app/src/app/api/cron/gong-sync/route.ts`
- `GET` - Cron endpoint for scheduled syncs (hourly check)

### 5. UI Components

**File**: `app/src/components/projects/edit-dialogs/gong-config-dialog.tsx`

Dialog component with:
- Connect form (access key, secret, sync frequency)
- Connected state showing stats and settings
- Manual sync button with progress display
- Disconnect button

### 6. Integrations Page Update

**File**: `app/src/app/(authenticated)/projects/[id]/integrations/page.tsx`

Updates:
- Add `gongConnected` state
- Fetch Gong status in `fetchStatuses`
- Add `showGongDialog` state and handlers
- Remove `comingSoon: true` from Gong entry
- Render `GongConfigDialog`

### 7. Assets

**File**: `app/public/logos/gong.svg`

Gong logo SVG (already exists based on GongIcon in page).

### 8. Configuration

**File**: `app/vercel.json` (create or update)

Add cron configuration:
```json
{
  "crons": [
    { "path": "/api/cron/gong-sync", "schedule": "0 * * * *" }
  ]
}
```

**File**: `app/.env.example`

Add:
```
ENCRYPTION_KEY=        # 32-byte key, base64 encoded (for API secrets)
CRON_SECRET=           # Optional: secret for cron endpoint auth
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
- `id`: `gong-{callId}-{timestamp}`
- `source`: `'gong'`
- `status`: `'closed'` (historical calls)
- `name`: Call title or auto-generated from date
- `user_metadata`: Gong call ID, URL, duration, participants, direction, scope

Transcript entries become messages:
- **External participants (customers)** -> `sender_type: 'user'` with speaker label
- **Internal participants (your team)** -> `sender_type: 'human_agent'` with speaker label
- Content format: `[Speaker Name]: {transcript text}`
- Speaker names from Gong participant data (name or email)

This maps naturally to the existing sender types:
- `'user'` - Customer/external party speaking
- `'human_agent'` - Your team member speaking (sales rep, support, etc.)
- `'ai'` - Hissuno AI agent responses (not used for Gong imports)
- `'system'` - Automated system messages (not used for Gong imports)

## Verification Steps

1. Create a test project
2. Configure Gong integration with valid API keys
3. Verify credentials are encrypted in database
4. Run manual sync and verify sessions are created
5. Check duplicate prevention (re-sync should skip existing calls)
6. Test sync frequency settings update
7. Test disconnect removes all related data

## File Summary

| File | Type | Description |
|------|------|-------------|
| `migrations/YYYYMMDDHHMMSS_add_gong_integration.sql` | Migration | DB schema |
| `lib/crypto/index.ts` | Utility | Encryption/decryption |
| `lib/integrations/gong/index.ts` | Service | Core Gong functions |
| `lib/integrations/gong/client.ts` | Service | Gong API client |
| `lib/integrations/gong/sync.ts` | Service | Sync logic |
| `api/integrations/gong/route.ts` | API | Status/settings/disconnect |
| `api/integrations/gong/connect/route.ts` | API | Save credentials |
| `api/integrations/gong/sync/route.ts` | API | Manual sync SSE |
| `api/cron/gong-sync/route.ts` | API | Scheduled sync cron |
| `components/.../gong-config-dialog.tsx` | UI | Config dialog |
| `projects/[id]/integrations/page.tsx` | UI | Page updates |
| `vercel.json` | Config | Cron schedule |
| `.env.example` | Config | New env vars |
