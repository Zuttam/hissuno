# Notion Integration for Knowledge System

## Context

Same motivation as the Google Drive integration - users need to bulk-import documents from external sources into the knowledge system. Many teams use Notion as their internal knowledge base, wiki, and documentation tool. This plan adds Notion as a knowledge source type, enabling users to connect their Notion workspace, browse pages/databases, and import them as knowledge sources.

The integration appears in two places: an entry on the Integrations page (for connecting/disconnecting the Notion workspace), and a "Notion" button in the knowledge sources panel (for browsing and importing pages).

## Notion API Key Differences from Google Drive

- **Auth**: Notion uses OAuth 2.0 with a simpler flow (no refresh tokens - access tokens don't expire)
- **Content model**: Pages and databases instead of files and folders. Pages contain blocks (paragraphs, headings, lists, etc.)
- **Export**: No file download - content is retrieved as blocks via the API and must be converted to markdown
- **Hierarchy**: Pages can be nested (parent/child), databases contain pages as entries
- **Search**: Notion has a built-in search API endpoint

## Architecture Overview

- **New knowledge source type**: `notion` - each imported page becomes one `knowledge_source` row
- **New DB table**: `notion_connections` - stores OAuth credentials per project
- **New DB column**: `notion_page_id` on `knowledge_sources` - links source to Notion page for re-fetching
- **OAuth**: Uses `NOTION_CLIENT_ID`/`NOTION_CLIENT_SECRET` (separate from Google)
- **API client**: Direct `fetch` calls to Notion API v1 (`https://api.notion.com/v1/`)
- **Page picker**: Custom in-app page browser with search, hierarchy navigation, and multi-select
- **Content fetching**: On-demand during analysis - retrieves blocks and converts to markdown

---

## Step 1: Database Schema

### New table: `notion_connections`

**File**: `app/src/lib/db/schema/app.ts`

```
notionConnections:
  id: uuid PK defaultRandom
  project_id: uuid NOT NULL UNIQUE -> projects.id
  access_token: text NOT NULL
  workspace_id: text NOT NULL
  workspace_name: text
  workspace_icon: text
  bot_id: text
  installed_by_user_id: text
  created_at: timestamp DEFAULT now()
  updated_at: timestamp DEFAULT now()
```

Note: No `refresh_token` or `token_expires_at` - Notion access tokens don't expire.

### New column on `knowledge_sources`

Add `notion_page_id: text('notion_page_id')` to the `knowledgeSources` table. Stores the Notion page ID for `notion` type sources.

### Relations

**File**: `app/src/lib/db/schema/relations.ts`
- Add `notionConnectionsRelations` (one-to-one with projects)

### Migration

Run `npx drizzle-kit generate` then `npx drizzle-kit push`

---

## Step 2: Notion Integration Module

Follow the Intercom integration pattern (`app/src/lib/integrations/intercom/`).

### `app/src/lib/integrations/notion/oauth.ts` (new)

- `getNotionOAuthUrl({ clientId, redirectUri, state })` - Builds Notion OAuth URL
  - Authorize URL: `https://api.notion.com/v1/oauth/authorize`
  - `owner=user` to request user-level access
- `exchangeNotionOAuthCode({ code, clientId, clientSecret, redirectUri })` - Exchanges code for access token
  - Token URL: `https://api.notion.com/v1/oauth/token`
  - Uses Basic auth header (`base64(clientId:clientSecret)`)
  - Returns: `{ access_token, workspace_id, workspace_name, workspace_icon, bot_id }`

### `app/src/lib/integrations/notion/client.ts` (new)

Lightweight class using direct `fetch` calls to `https://api.notion.com/v1/`:

```typescript
class NotionClient {
  constructor(params: { accessToken: string })

  // All requests include: Authorization: Bearer {token}, Notion-Version: 2022-06-28

  testConnection(): Promise<{ workspaceId: string; workspaceName: string }>
  // GET /v1/users/me - returns bot info with workspace

  search(params: { query?: string; filter?: { property: 'object'; value: 'page' | 'database' }; pageSize?: number; startCursor?: string }):
    Promise<{ results: NotionPage[]; nextCursor?: string; hasMore: boolean }>
  // POST /v1/search

  getPage(pageId: string): Promise<NotionPage>
  // GET /v1/pages/{pageId}

  getPageBlocks(pageId: string): Promise<NotionBlock[]>
  // GET /v1/blocks/{pageId}/children (paginated, fetches all)

  getDatabasePages(databaseId: string, params?: { startCursor?: string; pageSize?: number }):
    Promise<{ results: NotionPage[]; nextCursor?: string; hasMore: boolean }>
  // POST /v1/databases/{databaseId}/query
}

interface NotionPage {
  id: string
  object: 'page' | 'database'
  title: string  // extracted from properties
  icon?: { type: string; emoji?: string; external?: { url: string } }
  lastEditedTime: string
  parent: { type: string; page_id?: string; database_id?: string; workspace?: boolean }
  url: string
}

interface NotionBlock {
  id: string
  type: string  // paragraph, heading_1, heading_2, bulleted_list_item, etc.
  // Rich text content varies by block type
}
```

### `app/src/lib/integrations/notion/blocks-to-markdown.ts` (new)

Converts Notion blocks to markdown:

```typescript
function blocksToMarkdown(blocks: NotionBlock[]): string
```

Handles block types:
- `paragraph` -> plain text with newline
- `heading_1/2/3` -> `#/##/###`
- `bulleted_list_item` -> `- `
- `numbered_list_item` -> `1. `
- `to_do` -> `- [ ]` / `- [x]`
- `toggle` -> collapsible (render as heading + content)
- `code` -> fenced code block with language
- `quote` -> `> `
- `callout` -> `> ` with icon
- `divider` -> `---`
- `table` -> markdown table
- `child_page` -> `[Page Title](url)` link
- `child_database` -> `[Database Title](url)` link
- `image` -> `![](url)` (if external URL available)
- Rich text formatting: **bold**, *italic*, `code`, ~~strikethrough~~, [links](url)

### `app/src/lib/integrations/notion/index.ts` (new)

Service layer (pattern: `app/src/lib/integrations/intercom/index.ts`):

- `hasNotionConnection(projectId)` - Returns `{ connected, workspaceId, workspaceName }`
- `getNotionCredentials(projectId)` - Returns access token
- `storeNotionCredentials(params)` - Upsert with `onConflictDoUpdate` on `project_id`
- `disconnectNotion(projectId)` - Deletes connection row

---

## Step 3: API Routes

### `app/src/app/api/(project)/integrations/notion/connect/route.ts` (new)

`GET ?projectId=xxx` - Validates auth, encodes state, redirects to Notion OAuth URL.
Pattern: `app/src/app/api/(project)/integrations/intercom/connect/route.ts`

### `app/src/app/api/(project)/integrations/notion/callback/route.ts` (new)

`GET ?code=xxx&state=xxx` - Decodes state, exchanges code (which returns workspace info directly), stores credentials, redirects to integrations page with `?notion=connected`.
Pattern: `app/src/app/api/(project)/integrations/intercom/callback/route.ts`

### `app/src/app/api/(project)/integrations/notion/route.ts` (new)

- `GET ?projectId=xxx` - Returns connection status `{ connected, workspaceId, workspaceName }`
- `DELETE ?projectId=xxx` - Disconnects (deletes credentials, optionally deletes notion knowledge sources)

### `app/src/app/api/(project)/integrations/notion/pages/route.ts` (new)

`GET ?projectId=xxx&q=xxx&startCursor=xxx&filter=page|database`
- Gets credentials, creates `NotionClient`
- Uses Notion search API with optional query and filter
- Returns `{ pages: NotionPage[], nextCursor?, hasMore }`

### `app/src/app/api/(project)/integrations/notion/pages/[pageId]/children/route.ts` (new)

`GET ?projectId=xxx`
- For databases: returns child pages via `getDatabasePages`
- For pages: returns child pages by searching for pages with this parent
- Returns `{ pages: NotionPage[], nextCursor?, hasMore }`

---

## Step 4: Knowledge System Type Extension

### `app/src/lib/knowledge/types.ts` (modify)

- Add `'notion'` to `KnowledgeSourceType` union
- Add to `getSourceTypeLabel`: `notion: 'Notion'`
- Add case in `getSourceDisplayValue`: return `source.name ?? 'Notion page'`
- Add `notion_page_id: string | null` to `KnowledgeSourceRecord`, `KnowledgeSourceInsert`, `KnowledgeSourceUpdate`

### `app/src/mastra/workflows/source-analysis/schemas.ts` (modify)

- Add `'notion'` to the `sourceType` z.enum
- Add optional `notionPageId: z.string().nullable()` to `sourceAnalysisInputSchema`

---

## Step 5: Analysis Pipeline - Content Fetching

### `app/src/mastra/workflows/source-analysis/steps/fetch-content.ts` (modify)

Add `case 'notion':` block:

1. Import and call `getNotionCredentials(projectId)`
2. Create `NotionClient` with access token
3. Call `client.getPageBlocks(notionPageId)` to get all blocks (handles pagination)
4. Convert blocks to markdown via `blocksToMarkdown(blocks)`
5. Return markdown as `fetchedContent`
6. Error handling: if credentials missing/revoked, return empty with error message

No token refresh needed - Notion tokens don't expire (they remain valid until the user revokes the integration).

---

## Step 6: Knowledge Sources API Update

### `app/src/app/api/(project)/settings/knowledge-sources/route.ts` (modify)

**POST handler**:
- Add `'notion'` to `USER_ADDABLE_TYPES`
- Handle `notion` type: accept `{ type: 'notion', notionPageId, name, url }` or bulk: `{ type: 'notion_bulk', pages: [{ pageId, title, url }] }`
- Validate Notion connection exists
- Check for duplicate imports (same `notion_page_id` + `project_id`)
- Store Notion page URL in the `url` field
- For bulk: insert multiple rows in one transaction

**DELETE handler**:
- No special cleanup needed for `notion` type

---

## Step 7: Client API Layer

### `app/src/lib/api/integrations.ts` (modify)

Add:
- `fetchNotionStatus(projectId)` - GET status
- `fetchNotionPages(projectId, params)` - GET page search/listing
- `fetchNotionChildPages(projectId, pageId)` - GET child pages for databases/parent pages
- `disconnectNotion(projectId)` - DELETE

### `app/src/lib/api/knowledge.ts` (modify)

Add:
- `addNotionSources(projectId, pages)` - POST bulk create

---

## Step 8: Integrations Page

### `app/src/app/(authenticated)/projects/[id]/integrations/page.tsx` (modify)

- Add `notion` to integration list under the **Knowledge** category (same category as Google Drive)
- Add `fetchNotionStatus` to status fetches
- Add `notionConnected` state
- Add `NotionConfigDialog` import and rendering
- Handle `?notion=connected` URL param for OAuth return

### `app/src/components/projects/integrations/notion-config-dialog.tsx` (new)

Config dialog showing:
- Connection status (workspace name or "Connect" button)
- "Connect Notion" button -> opens OAuth flow
- "Disconnect" button when connected
- Brief description of what Notion integration does

### `public/logos/notion.svg` (new)

Notion logo icon.

---

## Step 9: Knowledge Sources Panel - Notion Page Picker

### `app/src/components/projects/configuration/knowledge-sources-panel.tsx` (modify)

- Add `notion` to `SOURCE_TYPE_CONFIG`:
  ```
  notion: { icon: <NotionIcon />, name: 'Notion', placeholder: '' }
  ```
- When user clicks "Add Notion":
  - If not connected: show alert with "Connect Notion" button
  - If connected: open the `NotionPickerDialog`
- For existing `notion` sources in the list: show page title, Notion icon, status

### `app/src/components/projects/configuration/notion-picker-dialog.tsx` (new)

Modal dialog with page browser:

**Layout**:
- Search bar at top (uses Notion search API)
- Results list with checkboxes for multi-select
- Each row: checkbox, page icon (emoji or default), title, last edited date, type badge (page/database)
- Databases are expandable (click to show child pages inline)
- "Load more" button for pagination
- Footer: "X pages selected" + "Import" button

**State**:
```typescript
{
  searchQuery: string
  pages: NotionPage[]
  expandedDatabaseId: string | null
  databaseChildren: NotionPage[]
  selectedPageIds: Set<string>
  isLoading: boolean
  nextCursor: string | null
  hasMore: boolean
  isImporting: boolean
}
```

**Behavior**:
- On open: search with empty query (returns recently edited pages)
- Type in search: debounced search via Notion search API
- Click database: expand inline to show child pages
- Import: calls `addNotionSources(projectId, selectedPages)`, closes dialog, refreshes source list

**Key UX difference from Google Drive**: Notion doesn't have a traditional folder hierarchy. The primary navigation is search-based, with databases expandable to show their entries. This matches how users actually find content in Notion.

---

## Step 10: Environment Variables

New env vars needed:
```
NOTION_CLIENT_ID=xxx
NOTION_CLIENT_SECRET=xxx
```

These are obtained from the Notion Developer Portal by creating an integration.

Update `app/env.example` with:
```
# Notion integration (optional - for importing Notion pages as knowledge sources)
NOTION_CLIENT_ID=
NOTION_CLIENT_SECRET=
```

---

## Files Summary

### New files (11):
1. `app/src/lib/integrations/notion/oauth.ts`
2. `app/src/lib/integrations/notion/client.ts`
3. `app/src/lib/integrations/notion/blocks-to-markdown.ts`
4. `app/src/lib/integrations/notion/index.ts`
5. `app/src/app/api/(project)/integrations/notion/connect/route.ts`
6. `app/src/app/api/(project)/integrations/notion/callback/route.ts`
7. `app/src/app/api/(project)/integrations/notion/route.ts`
8. `app/src/app/api/(project)/integrations/notion/pages/route.ts`
9. `app/src/components/projects/integrations/notion-config-dialog.tsx`
10. `app/src/components/projects/configuration/notion-picker-dialog.tsx`
11. `public/logos/notion.svg`

### Modified files (10):
1. `app/src/lib/db/schema/app.ts` - Add `notionConnections` table + `notion_page_id` column
2. `app/src/lib/db/schema/relations.ts` - Add relations
3. `app/src/lib/knowledge/types.ts` - Add `notion` type + `notion_page_id` field
4. `app/src/mastra/workflows/source-analysis/schemas.ts` - Add to enum
5. `app/src/mastra/workflows/source-analysis/steps/fetch-content.ts` - Add `notion` case
6. `app/src/app/api/(project)/settings/knowledge-sources/route.ts` - Handle notion + bulk
7. `app/src/lib/api/integrations.ts` - Add Notion status/pages functions
8. `app/src/lib/api/knowledge.ts` - Add bulk create function
9. `app/src/components/projects/configuration/knowledge-sources-panel.tsx` - Add Notion source type
10. `app/src/app/(authenticated)/projects/[id]/integrations/page.tsx` - Add Notion card + dialog

---

## Implementation Order

1. **DB schema** (table + column + migration)
2. **Integration module** (oauth.ts, client.ts, blocks-to-markdown.ts, index.ts)
3. **API routes** (connect, callback, status, pages)
4. **Knowledge type extension** (types.ts, schemas.ts)
5. **Analysis pipeline** (fetch-content.ts notion case)
6. **Knowledge sources API** (POST handler for notion + bulk)
7. **Client API** (integrations.ts, knowledge.ts)
8. **Integrations page** (card + config dialog)
9. **Knowledge panel + picker** (source type button + page browser dialog)

---

## Verification

1. **OAuth flow**: Navigate to integrations page, click Configure on Notion, click Connect, authorize in Notion, verify redirect back with `connected` status and workspace name
2. **Page browser**: Go to knowledge sources panel, click "Add Notion", verify search works, database expansion works, multi-select works
3. **Import**: Select pages and click Import, verify `knowledge_sources` rows created with `type=notion` and `notion_page_id` set
4. **Analysis**: Trigger analysis on an imported Notion source, verify blocks are fetched, converted to markdown, and `analyzed_content` is populated
5. **Block conversion**: Verify headings, lists, code blocks, tables, and rich text formatting convert correctly to markdown
6. **Disconnect**: Disconnect Notion from integrations page, verify credentials deleted
7. **Edge cases**: Try importing a page already imported (duplicate detection), try accessing after revoking integration in Notion (clear error)
