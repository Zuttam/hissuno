---
title: "Search API"
description: "Search across knowledge, feedback, issues, and customers via the REST API."
---

The Search API provides a unified search endpoint that queries across all resource types in your project - knowledge articles, feedback sessions, issues, and customers.

> **Authentication required.** All requests must include a valid API key in the `Authorization` header. See [Authentication](/docs/api/authentication) for details.

## Base URL

```
https://your-hissuno-instance.com
```

---

## Search resources

```
GET /api/search?projectId=YOUR_PROJECT_ID&q=your+query
```

Searches across project resources and returns ranked results. When no `type` filter is specified, all resource types are searched in parallel and results are sorted by relevance score.

### Query parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectId` | string | Yes | The project to search within |
| `q` | string | Yes | Search query text |
| `type` | string | No | Restrict search to a single resource type - `knowledge`, `feedback`, `issues`, or `customers` |
| `limit` | integer | No | Maximum number of results to return. Defaults to `10`, maximum `20` |

### Example request - search all types

```bash
curl -X GET "https://your-hissuno-instance.com/api/search?projectId=YOUR_PROJECT_ID&q=export%20csv" \
  -H "Authorization: Bearer hiss_your_api_key"
```

### Example request - search a specific type

```bash
curl -X GET "https://your-hissuno-instance.com/api/search?projectId=YOUR_PROJECT_ID&q=password%20reset&type=feedback&limit=5" \
  -H "Authorization: Bearer hiss_your_api_key"
```

### Example response

```json
{
  "results": [
    {
      "id": "iss_abc123",
      "type": "issues",
      "name": "Export button unresponsive on Chrome",
      "snippet": "Multiple users report that the CSV export button does not trigger a download...",
      "score": 0.92
    },
    {
      "id": "sess_def456",
      "type": "feedback",
      "name": "Support ticket #4821",
      "snippet": "The export button does nothing when I click it.",
      "score": 0.87
    },
    {
      "id": "kb_ghi789",
      "type": "knowledge",
      "name": "Exporting Reports",
      "snippet": "To export a report as CSV, click the Export button in the top-right corner...",
      "score": 0.65
    },
    {
      "id": "cust_jkl012",
      "type": "customers",
      "name": "Acme Corp",
      "snippet": "Enterprise customer - reported export issues in Q4",
      "score": 0.41
    }
  ],
  "total": 4
}
```

### Response fields

| Field | Type | Description |
|-------|------|-------------|
| `results` | array | Array of search result objects |
| `results[].id` | string | Unique identifier of the matched resource |
| `results[].type` | string | Resource type - `knowledge`, `feedback`, `issues`, or `customers` |
| `results[].name` | string | Display name or title of the resource |
| `results[].snippet` | string | Text excerpt showing the matching content |
| `results[].score` | number | Relevance score (optional - present when the adapter provides scoring) |
| `total` | integer | Total number of results returned |

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
| `400` | Missing or invalid parameters (e.g., missing `projectId` or `q`, invalid `type` value) |
| `401` | Missing or invalid API key |
| `403` | API key does not have access to this project |
| `500` | Internal server error |
