# Intercom Integration Implementation Plan

## Overview

Implement an Intercom integration that allows users to sync their Intercom conversations into Hissuno sessions for analysis. This is an API-key-based integration (bearer token) where users configure their Intercom access token, sync frequency, and optional date range filters.

## Key Features

1. **API Token Configuration**: Users provide their Intercom access token in the integrations page
2. **Configurable Sync**: User-selectable frequency (manual, hourly, 6h, daily)
3. **Date Range Filtering**: Optional date range for historical conversation import
4. **Session Creation**: Each Intercom conversation becomes a Hissuno session with messages
5. **Duplicate Prevention**: Track synced conversation IDs to avoid re-importing

## Intercom API Details

- **Base URL**: `https://api.intercom.io`
- **Auth**: `Authorization: Bearer <token>` + `Intercom-Version: 2.11` header
- **Key Endpoints**:
  - `GET /me` - Get workspace info (for connection test)
  - `GET /conversations?per_page=20&starting_after=cursor` - List conversations
  - `GET /conversations/{id}?display_as=plaintext` - Get conversation with parts
- **Rate Limits**: 10,000 calls/min per app
- **Pagination**: Cursor-based (`starting_after`)
- **Max 500 conversation parts per conversation**

## Implementation Files

### 1. Database Migration

**File**: `app/supabase/migrations/YYYYMMDDHHMMSS_add_intercom_integration.sql`

Creates three tables:
- `intercom_connections`: 1:1 project mapping with encrypted credentials and sync config
- `intercom_synced_conversations`: Track synced conversations to prevent duplicates
- `intercom_sync_runs`: Sync run history for debugging

Key columns for `intercom_connections`:
- `access_token_encrypted` (credential)
- `workspace_id`, `workspace_name`
- `sync_frequency` ('manual' | '1h' | '6h' | '24h')
- `sync_enabled`, `filter_config` (JSON with fromDate/toDate)
- `last_sync_at`, `last_sync_status`, `next_sync_at`

### 2. Crypto Utility

**File**: `app/src/lib/crypto/index.ts` (create if not exists)

Simple encryption utility using Node.js crypto with AES-256-GCM:
- `encrypt(text: string): Promise<string>` - Returns IV:authTag:ciphertext
- `decrypt(encrypted: string): Promise<string>` - Decrypts the above format

Uses `ENCRYPTION_KEY` env var (32-byte key, base64 encoded).

### 3. Service Layer

**File**: `app/src/lib/integrations/intercom/index.ts`

Core functions:
- `hasIntercomConnection(supabase, projectId)` - Check status
- `storeIntercomCredentials(supabase, params)` - Save encrypted token
- `updateIntercomSettings(supabase, projectId, settings)` - Update sync config
- `disconnectIntercom(supabase, projectId)` - Remove connection
- `getIntercomCredentials(supabase, projectId)` - Get decrypted token (internal)
- `isConversationAlreadySynced(supabase, connectionId, conversationId)` - Check duplicate
- `recordSyncedConversation(supabase, params)` - Record synced conversation
- `updateSyncState(supabase, projectId, state)` - Update sync status

**File**: `app/src/lib/integrations/intercom/client.ts`

Intercom API client class:
- `testConnection()` - Verify token via `/me` endpoint
- `listConversations(options)` - List with pagination
- `getConversation(id)` - Get full conversation with parts
- `listAllConversations(options)` - Async generator with date filtering

Includes `IntercomApiError` and `IntercomRateLimitError` classes.

**File**: `app/src/lib/integrations/intercom/sync.ts`

Sync service:
- `syncIntercomConversations(supabase, projectId, options)` - Main sync with progress callback
- Creates sessions from conversations with proper sender type mapping

### 4. API Routes

**File**: `app/src/app/api/integrations/intercom/route.ts`
- `GET` - Check connection status
- `PATCH` - Update sync settings
- `DELETE` - Disconnect integration

**File**: `app/src/app/api/integrations/intercom/connect/route.ts`
- `POST` - Validate and save API credentials

**File**: `app/src/app/api/integrations/intercom/sync/route.ts`
- `GET` - Trigger manual sync with SSE progress streaming

**File**: `app/src/app/api/cron/intercom-sync/route.ts`
- `GET` - Cron endpoint for scheduled syncs (hourly check)

### 5. UI Components

**File**: `app/src/components/projects/edit-dialogs/intercom-config-dialog.tsx`

Dialog component with:
- Connect form (access token, sync frequency, date range)
- Connected state showing workspace name, stats, settings
- Manual sync button with SSE progress display
- Settings update and disconnect buttons

### 6. Integrations Page Update

**File**: `app/src/app/(authenticated)/projects/[id]/integrations/page.tsx`

Updates:
- Import `IntercomConfigDialog`
- Add `intercomConnected` state
- Add `showIntercomDialog` state and handlers
- Fetch Intercom status in `fetchStatuses`
- Remove `comingSoon: true` from Intercom entry
- Render `IntercomConfigDialog`

### 7. Configuration

**File**: `app/vercel.json` (update)
```json
{
  "crons": [
    { "path": "/api/cron/intercom-sync", "schedule": "15 * * * *" }
  ]
}
```

**File**: `app/.env.example` (add if not present)
```
ENCRYPTION_KEY=        # 32-byte key, base64 encoded
CRON_SECRET=           # Optional: secret for cron endpoint auth
```

## Session Mapping

Each Intercom conversation creates a session with:
- `id`: `intercom-{conversationId}-{timestamp}`
- `source`: `'intercom'`
- `status`: `'closed'` (historical)
- `name`: Conversation title or auto-generated
- `user_metadata`: Contact info (name, email, intercom_conversation_id)

Conversation parts become messages:
- **Author type "user" (contact)** -> `sender_type: 'user'`
- **Author type "admin" (team member)** -> `sender_type: 'human_agent'`
- **Author type "bot"** -> `sender_type: 'ai'`
- **Author type "team"** -> `sender_type: 'human_agent'`

## File Summary

| File | Type | Description |
|------|------|-------------|
| `migrations/YYYYMMDDHHMMSS_add_intercom_integration.sql` | Migration | DB schema |
| `lib/crypto/index.ts` | Utility | Encryption/decryption |
| `lib/integrations/intercom/index.ts` | Service | Core functions |
| `lib/integrations/intercom/client.ts` | Service | API client |
| `lib/integrations/intercom/sync.ts` | Service | Sync logic |
| `api/integrations/intercom/route.ts` | API | Status/settings/disconnect |
| `api/integrations/intercom/connect/route.ts` | API | Save credentials |
| `api/integrations/intercom/sync/route.ts` | API | Manual sync SSE |
| `api/cron/intercom-sync/route.ts` | API | Scheduled sync cron |
| `components/.../intercom-config-dialog.tsx` | UI | Config dialog |
| `projects/[id]/integrations/page.tsx` | UI | Page updates |
| `vercel.json` | Config | Cron schedule |

## Verification Steps

1. Create a test project
2. Configure Intercom integration with a valid access token
3. Verify credentials are encrypted in database
4. Run manual sync and verify sessions are created
5. Check session messages have correct sender types
6. Check duplicate prevention (re-sync should skip existing conversations)
7. Test sync frequency settings update
8. Test disconnect removes connection (cascades to synced records)
9. Verify SSE progress events during sync
10. Test cron endpoint processes due connections

## Critical Files to Reference

These existing files contain patterns to follow:
- `app/src/lib/integrations/slack/index.ts` - Service layer structure
- `app/src/lib/integrations/slack/client.ts` - API client pattern
- `app/src/components/projects/edit-dialogs/slack-config-dialog.tsx` - Dialog UI pattern
- `app/src/app/(authenticated)/projects/[id]/integrations/page.tsx` - Integration page
