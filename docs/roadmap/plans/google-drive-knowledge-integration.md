# Google Drive Integration for Knowledge System

## Context

Users currently add knowledge sources (codebase, website, docs portal, uploaded files, raw text) one at a time. There's no way to bulk-import documents from a cloud storage provider. This plan adds Google Drive as a new knowledge source type, enabling users to connect their Google Drive, browse files, and import multiple documents at once into the knowledge system.

The integration appears in two places: an entry on the Integrations page (for connecting/disconnecting the Google account), and a "Google Drive" button in the knowledge sources panel (for browsing and importing files).

## Architecture Overview

- **New knowledge source type**: `google_drive` - each imported file becomes one `knowledge_source` row
- **New DB table**: `google_drive_connections` - stores OAuth credentials per project (follows Intercom pattern)
- **New DB column**: `google_drive_file_id` on `knowledge_sources` - links source to Drive file for re-fetching
- **OAuth**: Reuses `AUTH_GOOGLE_CLIENT_ID`/`AUTH_GOOGLE_CLIENT_SECRET` with `drive.readonly` scope
- **API client**: Direct `fetch` calls to Google Drive API v3 (no `googleapis` package)
- **File picker**: Custom in-app file browser dialog with folder navigation, search, and multi-select
- **Content fetching**: On-demand during analysis (not pre-downloaded)

---

## Step 1: Database Schema

### New table: `google_drive_connections`

**File**: `app/src/lib/db/schema/app.ts`

```
googleDriveConnections:
  id: uuid PK defaultRandom
  project_id: uuid NOT NULL UNIQUE -> projects.id
  access_token: text NOT NULL
  refresh_token: text NOT NULL
  token_expires_at: timestamp NOT NULL
  connected_email: text (Google account email)
  installed_by_user_id: text
  created_at: timestamp DEFAULT now()
  updated_at: timestamp DEFAULT now()
```

### New column on `knowledge_sources`

Add `google_drive_file_id: text('google_drive_file_id')` to the `knowledgeSources` table. Stores the Drive file ID for `google_drive` type sources.

### Relations

**File**: `app/src/lib/db/schema/relations.ts`
- Add `googleDriveConnectionsRelations` (one-to-one with projects)

### Migration

Run `npx drizzle-kit generate` then `npx drizzle-kit push`

---

## Step 2: Google Drive Integration Module

Follow the Intercom integration pattern exactly (`app/src/lib/integrations/intercom/`).

### `app/src/lib/integrations/google-drive/oauth.ts` (new)

- `getGoogleDriveOAuthUrl({ clientId, redirectUri, state })` - Builds Google OAuth URL
  - Scope: `https://www.googleapis.com/auth/drive.readonly`
  - `access_type=offline`, `prompt=consent` (to get refresh token)
- `exchangeGoogleDriveOAuthCode({ code, clientId, clientSecret, redirectUri })` - Exchanges code for tokens via `https://oauth2.googleapis.com/token`
- `refreshGoogleDriveAccessToken({ refreshToken, clientId, clientSecret })` - Refreshes expired access token

### `app/src/lib/integrations/google-drive/client.ts` (new)

Lightweight class using direct `fetch` calls to `https://www.googleapis.com/drive/v3/`:

```typescript
class GoogleDriveClient {
  constructor(params: { accessToken: string; refreshToken: string; tokenExpiresAt: Date; projectId: string })

  // Auto-refreshes token if expiring within 5 min, persists new token to DB
  private ensureFreshToken(): Promise<void>

  testConnection(): Promise<{ email: string }>
  // Uses drive.about.get with fields=user

  listFiles(params: { folderId?: string; query?: string; pageToken?: string; pageSize?: number }):
    Promise<{ files: DriveFile[]; nextPageToken?: string }>
  // Queries: mimeType != 'application/vnd.google-apps.folder' OR mimeType = folder
  // Fields: id, name, mimeType, modifiedTime, iconLink, size, parents

  downloadFileContent(fileId: string, mimeType: string): Promise<string>
  // Google Docs -> export as text/plain
  // Google Sheets -> export as text/csv
  // Google Slides -> export as text/plain
  // PDF -> download, extract via pdf-parse (reuse from document-tools.ts)
  // TXT/MD -> download directly
  // DOC/DOCX -> download, extract (reuse from document-tools.ts)
}

interface DriveFile {
  id: string; name: string; mimeType: string
  modifiedTime: string; iconLink?: string; size?: string
}
```

Reuse PDF extraction from `app/src/mastra/tools/document-tools.ts`.

### `app/src/lib/integrations/google-drive/index.ts` (new)

Service layer (pattern: `app/src/lib/integrations/intercom/index.ts`):

- `hasGoogleDriveConnection(projectId)` - Returns `{ connected, email }`
- `getGoogleDriveCredentials(projectId)` - Returns tokens
- `storeGoogleDriveCredentials(params)` - Upsert with `onConflictDoUpdate` on `project_id`
- `updateGoogleDriveTokens(projectId, { accessToken, tokenExpiresAt })` - After refresh
- `disconnectGoogleDrive(projectId)` - Deletes connection row

---

## Step 3: API Routes

### `app/src/app/api/(project)/integrations/google-drive/connect/route.ts` (new)

`GET ?projectId=xxx` - Validates auth, encodes state, redirects to Google OAuth URL.
Pattern: `app/src/app/api/(project)/integrations/intercom/connect/route.ts`

### `app/src/app/api/(project)/integrations/google-drive/callback/route.ts` (new)

`GET ?code=xxx&state=xxx` - Decodes state, exchanges code, validates with `testConnection`, stores credentials, redirects to integrations page with `?google-drive=connected`.
Pattern: `app/src/app/api/(project)/integrations/intercom/callback/route.ts`

### `app/src/app/api/(project)/integrations/google-drive/route.ts` (new)

- `GET ?projectId=xxx` - Returns connection status `{ connected, email }`
- `DELETE ?projectId=xxx` - Disconnects (deletes credentials, optionally deletes google_drive knowledge sources)

### `app/src/app/api/(project)/integrations/google-drive/files/route.ts` (new)

`GET ?projectId=xxx&folderId=xxx&q=xxx&pageToken=xxx`
- Gets credentials, creates `GoogleDriveClient`
- Lists files with search/folder filtering
- Returns `{ files: DriveFile[], nextPageToken? }`
- Filters to supported types: Google Docs/Sheets/Slides, PDF, TXT, MD, DOC, DOCX, and folders

---

## Step 4: Knowledge System Type Extension

### `app/src/lib/knowledge/types.ts` (modify)

- Add `'google_drive'` to `KnowledgeSourceType` union
- Add to `getSourceTypeLabel`: `google_drive: 'Google Drive'`
- Add case in `getSourceDisplayValue`: return `source.name ?? 'Google Drive document'`
- Add `google_drive_file_id: string | null` to `KnowledgeSourceRecord`, `KnowledgeSourceInsert`, `KnowledgeSourceUpdate`

### `app/src/mastra/workflows/source-analysis/schemas.ts` (modify)

- Add `'google_drive'` to the `sourceType` z.enum
- Add optional `googleDriveFileId: z.string().nullable()` to `sourceAnalysisInputSchema`

---

## Step 5: Analysis Pipeline - Content Fetching

### `app/src/mastra/workflows/source-analysis/steps/fetch-content.ts` (modify)

Add `case 'google_drive':` block:

1. Import and call `getGoogleDriveCredentials(projectId)`
2. Create `GoogleDriveClient` with credentials
3. Call `client.downloadFileContent(googleDriveFileId, mimeType)` to get text
4. If token was refreshed, it's already persisted by the client
5. Return extracted text as `fetchedContent`
6. Error handling: if credentials missing/revoked, return empty with error message

The file's mimeType can be determined by calling `listFiles` with the file ID, or stored in the source record's `url` field as metadata.

---

## Step 6: Knowledge Sources API Update

### `app/src/app/api/(project)/settings/knowledge-sources/route.ts` (modify)

**POST handler**:
- Add `'google_drive'` to `USER_ADDABLE_TYPES`
- Handle `google_drive` type: accept `{ type: 'google_drive', googleDriveFileId, name, mimeType }` or bulk: `{ type: 'google_drive_bulk', files: [{ fileId, name, mimeType }] }`
- Validate Google Drive connection exists
- Check for duplicate imports (same `google_drive_file_id` + `project_id`)
- Store `mimeType` in the `url` field (or add to `content` field as metadata JSON)
- For bulk: insert multiple rows in one transaction, return array of created sources

**DELETE handler**:
- No special cleanup needed for `google_drive` type (no local storage)

---

## Step 7: Client API Layer

### `app/src/lib/api/integrations.ts` (modify)

Add:
- `fetchGoogleDriveStatus(projectId)` - GET status
- `fetchGoogleDriveFiles(projectId, params)` - GET file listing
- `disconnectGoogleDrive(projectId)` - DELETE

### `app/src/lib/api/knowledge.ts` (modify)

Add:
- `addGoogleDriveSources(projectId, files)` - POST bulk create

---

## Step 8: Integrations Page

### `app/src/app/(authenticated)/projects/[id]/integrations/page.tsx` (modify)

- Add `google-drive` to integration list under a new **Knowledge** category (like GitHub is under Development)
- Add `fetchGoogleDriveStatus` to status fetches
- Add `googleDriveConnected` state
- Add `GoogleDriveConfigDialog` import and rendering
- Handle `?google-drive=connected` URL param for OAuth return

### `app/src/components/projects/integrations/google-drive-config-dialog.tsx` (new)

Config dialog showing:
- Connection status (connected email or "Connect" button)
- "Connect Google Drive" button -> opens OAuth flow
- "Disconnect" button when connected
- Brief description of what Google Drive integration does

Pattern: simpler than Intercom (no sync settings, just connect/disconnect).

### `public/logos/google-drive.svg` (new)

Google Drive logo icon.

---

## Step 9: Knowledge Sources Panel - Google Drive Picker

### `app/src/components/projects/configuration/knowledge-sources-panel.tsx` (modify)

- Add `google_drive` to `SOURCE_TYPE_CONFIG`:
  ```
  google_drive: { icon: <GoogleDriveIcon />, name: 'Google Drive', placeholder: '' }
  ```
- When user clicks "Add Google Drive":
  - If not connected: show alert with "Connect Google Drive" button (like codebase shows for GitHub)
  - If connected: open the `GoogleDrivePickerDialog`
- For existing `google_drive` sources in the list: show file name, Drive icon, status
- Edit mode: show name, "Remove" button (no content editing)

### `app/src/components/projects/configuration/google-drive-picker-dialog.tsx` (new)

Modal dialog with in-app file browser:

**Layout**:
- Search bar at top
- Breadcrumb navigation (My Drive > Folder > Subfolder)
- File/folder list with checkboxes for multi-select
- Each row: checkbox, icon, name, modified date, type badge
- Folders are clickable (navigate into)
- "Load more" button for pagination
- Footer: "X files selected" + "Import" button

**State**:
```typescript
{
  currentFolderId: string | null  // null = root
  breadcrumbs: { id: string; name: string }[]
  files: DriveFile[]
  selectedFileIds: Set<string>
  searchQuery: string
  isLoading: boolean
  nextPageToken: string | null
  isImporting: boolean
}
```

**Behavior**:
- On open: fetch root files
- Click folder: push to breadcrumbs, fetch folder contents
- Click breadcrumb: pop breadcrumbs, fetch that folder
- Search: debounced query to files API
- Import: calls `addGoogleDriveSources(projectId, selectedFiles)`, closes dialog, refreshes source list

**Supported file types** (show only these + folders):
- `application/vnd.google-apps.document` (Google Docs)
- `application/vnd.google-apps.spreadsheet` (Google Sheets)
- `application/vnd.google-apps.presentation` (Google Slides)
- `application/pdf`
- `text/plain`, `text/markdown`
- `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

---

## Step 10: Token Refresh Strategy

Handled transparently in `GoogleDriveClient.ensureFreshToken()`:
1. Check if `tokenExpiresAt` is within 5 minutes of now
2. If so, call `refreshGoogleDriveAccessToken()` from oauth.ts
3. Update DB via `updateGoogleDriveTokens(projectId, newTokens)`
4. Update in-memory token for current request

This runs before every API call. No cron job needed.

---

## Files Summary

### New files (10):
1. `app/src/lib/integrations/google-drive/oauth.ts`
2. `app/src/lib/integrations/google-drive/client.ts`
3. `app/src/lib/integrations/google-drive/index.ts`
4. `app/src/app/api/(project)/integrations/google-drive/connect/route.ts`
5. `app/src/app/api/(project)/integrations/google-drive/callback/route.ts`
6. `app/src/app/api/(project)/integrations/google-drive/route.ts`
7. `app/src/app/api/(project)/integrations/google-drive/files/route.ts`
8. `app/src/components/projects/integrations/google-drive-config-dialog.tsx`
9. `app/src/components/projects/configuration/google-drive-picker-dialog.tsx`
10. `public/logos/google-drive.svg`

### Modified files (10):
1. `app/src/lib/db/schema/app.ts` - Add `googleDriveConnections` table + `google_drive_file_id` column
2. `app/src/lib/db/schema/relations.ts` - Add relations
3. `app/src/lib/knowledge/types.ts` - Add `google_drive` type + `google_drive_file_id` field
4. `app/src/mastra/workflows/source-analysis/schemas.ts` - Add to enum
5. `app/src/mastra/workflows/source-analysis/steps/fetch-content.ts` - Add `google_drive` case
6. `app/src/app/api/(project)/settings/knowledge-sources/route.ts` - Handle google_drive + bulk
7. `app/src/lib/api/integrations.ts` - Add Google Drive status/files functions
8. `app/src/lib/api/knowledge.ts` - Add bulk create function
9. `app/src/components/projects/configuration/knowledge-sources-panel.tsx` - Add Google Drive source type
10. `app/src/app/(authenticated)/projects/[id]/integrations/page.tsx` - Add Google Drive card + dialog

---

## Implementation Order

1. **DB schema** (table + column + migration)
2. **Integration module** (oauth.ts, client.ts, index.ts)
3. **API routes** (connect, callback, status, files)
4. **Knowledge type extension** (types.ts, schemas.ts)
5. **Analysis pipeline** (fetch-content.ts google_drive case)
6. **Knowledge sources API** (POST handler for google_drive + bulk)
7. **Client API** (integrations.ts, knowledge.ts)
8. **Integrations page** (card + config dialog)
9. **Knowledge panel + picker** (source type button + file browser dialog)

---

## Verification

1. **OAuth flow**: Navigate to integrations page, click Configure on Google Drive, click Connect, complete Google consent, verify redirect back with `connected` status and email displayed
2. **File browser**: Go to knowledge sources panel, click "Add Google Drive", verify file list loads, navigate folders, search works, multi-select works
3. **Import**: Select files and click Import, verify `knowledge_sources` rows created with `type=google_drive` and `google_drive_file_id` set
4. **Analysis**: Trigger analysis on an imported Google Drive source, verify content is fetched from Drive API and `analyzed_content` is populated
5. **Token refresh**: Wait for token expiry (or set a short expiry), verify API calls still work after auto-refresh
6. **Disconnect**: Disconnect Google Drive from integrations page, verify credentials deleted
7. **Edge cases**: Try importing a file that was already imported (should detect duplicate), try accessing after revoking Google permissions (should show clear error)
