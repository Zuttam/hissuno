---
title: "Sessions API"
description: "Create, list, and retrieve feedback sessions via the REST API."
---

The Sessions API lets you ingest feedback from any source and retrieve session data programmatically. Sessions represent individual feedback conversations, meeting transcripts, or behavioral events.

> **Authentication required.** All requests must include a valid API key in the `Authorization` header. See [Authentication](/docs/api/authentication) for details.

## Base URL

```
https://your-hissuno-instance.com
```

---

## List sessions

```
GET /api/sessions?projectId=YOUR_PROJECT_ID
```

Returns a paginated list of sessions for the specified project.

### Query parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectId` | string | Yes | The project to list sessions for |
| `search` | string | No | Free-text search across session name and content |
| `sessionId` | string | No | Filter by a specific session ID |
| `name` | string | No | Filter by session name |
| `status` | string | No | Filter by status - `active` or `closed` |
| `source` | string | No | Filter by source channel - `widget`, `slack`, `intercom`, `zendesk`, `gong`, `posthog`, `api`, or `manual` |
| `tags` | string | No | Comma-separated list of tags to filter by (e.g., `bug,feature_request`) |
| `dateFrom` | string | No | ISO 8601 date - return sessions created on or after this date |
| `dateTo` | string | No | ISO 8601 date - return sessions created on or before this date |
| `showArchived` | boolean | No | Include archived sessions. Defaults to `false` |
| `isHumanTakeover` | boolean | No | Filter to sessions where a human agent took over |
| `isAnalyzed` | boolean | No | Filter to sessions that have been analyzed |
| `companyId` | string | No | Filter by associated company ID |
| `contactId` | string | No | Filter by associated contact ID |
| `productScopeIds` | string | No | Comma-separated list of product scope IDs to filter by |
| `limit` | integer | No | Maximum number of sessions to return. Defaults to `50` |
| `offset` | integer | No | Number of sessions to skip for pagination |
| `stats` | boolean | No | When `true`, returns integration stats instead of sessions |

### Example request

```bash
curl -X GET "https://your-hissuno-instance.com/api/sessions?projectId=YOUR_PROJECT_ID&status=active&limit=10" \
  -H "Authorization: Bearer hiss_your_api_key"
```

### Example response

```json
{
  "sessions": [
    {
      "id": "sess_abc123",
      "project_id": "proj_xyz",
      "name": "Login flow confusion",
      "description": null,
      "status": "active",
      "source": "widget",
      "session_type": "chat",
      "message_count": 5,
      "analysis_status": "analyzed",
      "tags": ["bug"],
      "custom_fields": {},
      "user_metadata": {
        "email": "jane@example.com"
      },
      "page_url": "https://app.example.com/login",
      "page_title": "Sign In",
      "is_archived": false,
      "is_human_takeover": false,
      "first_message_at": "2026-01-15T10:30:00.000Z",
      "last_activity_at": "2026-01-15T10:35:00.000Z",
      "created_at": "2026-01-15T10:30:00.000Z",
      "updated_at": "2026-01-15T10:35:00.000Z"
    }
  ],
  "total": 1
}
```

---

## Get a session

```
GET /api/sessions/:sessionId?projectId=YOUR_PROJECT_ID
```

Returns a single session with its full message history. The session must belong to the specified project.

### Path parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sessionId` | string | Yes | The session ID |

### Query parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectId` | string | Yes | The project this session belongs to |

### Example request

```bash
curl -X GET "https://your-hissuno-instance.com/api/sessions/sess_abc123?projectId=YOUR_PROJECT_ID" \
  -H "Authorization: Bearer hiss_your_api_key"
```

### Example response

```json
{
  "session": {
    "id": "sess_abc123",
    "project_id": "proj_xyz",
    "name": "Login flow confusion",
    "status": "active",
    "source": "widget",
    "session_type": "chat",
    "message_count": 3,
    "tags": ["bug"],
    "custom_fields": {},
    "user_metadata": {
      "email": "jane@example.com"
    },
    "created_at": "2026-01-15T10:30:00.000Z",
    "updated_at": "2026-01-15T10:35:00.000Z"
  },
  "messages": [
    {
      "id": "msg_001",
      "role": "user",
      "content": "I can't figure out how to reset my password.",
      "createdAt": "2026-01-15T10:30:00.000Z",
      "senderType": "user"
    },
    {
      "id": "msg_002",
      "role": "assistant",
      "content": "I can help with that. Click the 'Forgot Password' link on the login page.",
      "createdAt": "2026-01-15T10:30:15.000Z",
      "senderType": "ai"
    },
    {
      "id": "msg_003",
      "role": "user",
      "content": "There is no forgot password link. That's the problem.",
      "createdAt": "2026-01-15T10:31:00.000Z",
      "senderType": "user"
    }
  ]
}
```

---

## Create a session

```
POST /api/sessions?projectId=YOUR_PROJECT_ID
```

Creates a new session with optional messages. Use this to ingest feedback from external sources such as support tickets, call transcripts, or survey responses.

### Query parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectId` | string | Yes | The project to create the session in |

### Request body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Display name for the session |
| `description` | string | No | Brief description of the session context |
| `session_type` | string | No | Content type - `chat`, `meeting`, or `behavioral`. Defaults to `chat` |
| `contact_id` | string | No | ID of an existing contact to associate with this session |
| `user_id` | string | No | External user identifier (stored in `user_metadata.userId`) |
| `user_metadata` | object | No | Key-value metadata about the user (e.g., `{ "email": "...", "name": "..." }`) |
| `page_url` | string | No | URL where the feedback was captured |
| `page_title` | string | No | Title of the page where feedback was captured |
| `tags` | string[] | No | Classification tags. Valid values: `general_feedback`, `wins`, `losses`, `bug`, `feature_request`, `change_request` |
| `custom_fields` | object | No | Arbitrary key-value data for custom fields |
| `linked_entities` | object | No | Entity IDs to link - `{ companies?: string[], issues?: string[], knowledge_sources?: string[], product_scopes?: string[] }` |
| `messages` | array | No | Array of message objects to include in the session |

### Message object

Each item in the `messages` array has the following shape:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `role` | string | Yes | Message sender role - `user` or `assistant` |
| `content` | string | Yes | The message text |

### Example request

```bash
curl -X POST "https://your-hissuno-instance.com/api/sessions?projectId=YOUR_PROJECT_ID" \
  -H "Authorization: Bearer hiss_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Support ticket #4821",
    "session_type": "chat",
    "tags": ["bug"],
    "user_metadata": {
      "email": "jane@example.com",
      "name": "Jane Smith"
    },
    "messages": [
      { "role": "user", "content": "The export button does nothing when I click it." },
      { "role": "assistant", "content": "Thanks for reporting this. Can you tell me which browser you are using?" },
      { "role": "user", "content": "Chrome on macOS. Version 120." }
    ]
  }'
```

### Example response

```json
{
  "session": {
    "id": "sess_new456",
    "project_id": "proj_xyz",
    "name": "Support ticket #4821",
    "status": "active",
    "source": "api",
    "session_type": "chat",
    "message_count": 3,
    "tags": ["bug"],
    "custom_fields": {},
    "user_metadata": {
      "email": "jane@example.com",
      "name": "Jane Smith"
    },
    "created_at": "2026-01-16T14:00:00.000Z",
    "updated_at": "2026-01-16T14:00:00.000Z"
  }
}
```

---

## Error responses

All endpoints return errors in the following format:

```json
{
  "error": "Description of the problem."
}
```

| Status | Meaning |
|--------|---------|
| `400` | Missing or invalid parameters (e.g., missing `projectId`) |
| `401` | Missing or invalid API key |
| `403` | API key does not have access to this project |
| `404` | Session not found or does not belong to this project |
| `500` | Internal server error |
