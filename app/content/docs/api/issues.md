---
title: "Issues API"
description: "Create and list product issues via the REST API."
---

The Issues API lets you create and retrieve product issues - bugs, feature requests, and change requests - that are tracked across your project.

> **Authentication required.** All requests must include a valid API key in the `Authorization` header. See [Authentication](/docs/api/authentication) for details.

## Base URL

```
https://your-hissuno-instance.com
```

---

## List issues

```
GET /api/issues?projectId=YOUR_PROJECT_ID
```

Returns a paginated list of issues for the specified project. Supports filtering by type, priority, status, and RICE metric levels.

### Query parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectId` | string | Yes | The project to list issues for |
| `type` | string | No | Filter by issue type - `bug`, `feature_request`, or `change_request` |
| `priority` | string | No | Filter by priority - `low`, `medium`, or `high` |
| `status` | string | No | Filter by status - `open`, `ready`, `in_progress`, `resolved`, or `closed` |
| `search` | string | No | Free-text search across issue title and description |
| `showArchived` | boolean | No | Include archived issues. Defaults to `false` |
| `reachLevel` | string | No | Filter by reach metric level - `low`, `medium`, or `high` |
| `impactLevel` | string | No | Filter by impact metric level - `low`, `medium`, or `high` |
| `confidenceLevel` | string | No | Filter by confidence metric level - `low`, `medium`, or `high` |
| `effortLevel` | string | No | Filter by effort metric level - `low`, `medium`, or `high` |
| `productScopeIds` | string | No | Comma-separated list of product scope IDs to filter by |
| `goalId` | string | No | Filter to issues aligned with a specific goal |
| `limit` | integer | No | Maximum number of issues to return |
| `offset` | integer | No | Number of issues to skip for pagination |

### Example request

```bash
curl -X GET "https://your-hissuno-instance.com/api/issues?projectId=YOUR_PROJECT_ID&type=bug&status=open&limit=20" \
  -H "Authorization: Bearer hiss_your_api_key"
```

### Example response

```json
{
  "issues": [
    {
      "id": "iss_abc123",
      "project_id": "proj_xyz",
      "type": "bug",
      "title": "Export button unresponsive on Chrome",
      "description": "Multiple users report that the CSV export button does not trigger a download on Chrome 120+.",
      "priority": "high",
      "priority_manual_override": false,
      "status": "open",
      "upvote_count": 4,
      "brief": null,
      "is_archived": false,
      "custom_fields": {},
      "impact_score": 4,
      "reach_score": 3,
      "confidence_score": 5,
      "effort_score": 2,
      "created_at": "2026-01-10T09:00:00.000Z",
      "updated_at": "2026-01-15T11:00:00.000Z"
    }
  ],
  "total": 1
}
```

---

## Create an issue

```
POST /api/issues?projectId=YOUR_PROJECT_ID
```

Creates a new issue for the specified project. Requires `type`, `title`, and `description`.

### Query parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectId` | string | Yes | The project to create the issue in |

### Request body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Issue type - `bug`, `feature_request`, or `change_request` |
| `title` | string | Yes | Short title describing the issue |
| `description` | string | Yes | Detailed description of the issue |
| `priority` | string | No | Priority level - `low`, `medium`, or `high`. Defaults to `medium` |
| `session_ids` | string[] | No | Array of session IDs to link as evidence for this issue |
| `product_scope_id` | string | No | Product area ID to associate with this issue |
| `custom_fields` | object | No | Arbitrary key-value data for custom fields |

### Example request

```bash
curl -X POST "https://your-hissuno-instance.com/api/issues?projectId=YOUR_PROJECT_ID" \
  -H "Authorization: Bearer hiss_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "bug",
    "title": "Export button unresponsive on Chrome",
    "description": "Clicking the CSV export button on the reports page does nothing in Chrome 120+. Works in Firefox and Safari.",
    "priority": "high",
    "session_ids": ["sess_abc123", "sess_def456"]
  }'
```

### Example response

```json
{
  "issue": {
    "id": "iss_new789",
    "project_id": "proj_xyz",
    "type": "bug",
    "title": "Export button unresponsive on Chrome",
    "description": "Clicking the CSV export button on the reports page does nothing in Chrome 120+. Works in Firefox and Safari.",
    "priority": "high",
    "priority_manual_override": false,
    "status": "open",
    "upvote_count": 0,
    "brief": null,
    "is_archived": false,
    "custom_fields": {},
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
| `400` | Missing or invalid parameters (e.g., missing `projectId`, `type`, `title`, or `description`) |
| `401` | Missing or invalid API key |
| `403` | API key does not have access to this project |
| `500` | Internal server error |
