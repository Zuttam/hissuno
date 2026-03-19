---
title: "API Overview"
description: "Introduction to the Hissuno API, including internal endpoints, authentication, rate limits, and planned public API."
---

## Introduction

Hissuno provides an internal REST API that powers the dashboard, widget, and integrations. The API is structured around project-scoped endpoints at `/api/projects/[id]/...` and is authenticated using API keys or session-based auth.

A public API SDK is planned but not yet available. The information below describes the current internal API and how to interact with it programmatically.

All API access is scoped to a specific project and authenticated using API keys managed on the **Access** page in the sidebar.

## Internal API Structure

The Hissuno API is organized as Next.js API routes under the `/api/` path. Project-scoped endpoints follow this pattern:

```
/api/projects/:projectId/sessions
/api/projects/:projectId/issues
/api/projects/:projectId/customers
/api/projects/:projectId/knowledge
```

These endpoints are used internally by the Hissuno dashboard and widget. While they can be called programmatically, they are not yet documented as a stable public API and may change without notice.

## Authentication

API requests are authenticated using API keys passed in the `Authorization` header:

```
Authorization: Bearer hss_your_api_key_here
```

API keys are project-scoped, meaning each key grants access to a single Hissuno project. Keys are managed on the **Access** page in the sidebar. See the [Authentication](/docs/api/authentication) page for details on generating and managing keys.

## Request Format

### Content Type

All request bodies must be sent as JSON with the `Content-Type: application/json` header.

```bash
curl -X POST /api/projects/:projectId/sessions \
  -H "Authorization: Bearer hss_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{"customer_email": "jane@example.com", "message": "How do I export data?"}'
```

## Response Format

All responses are returned as JSON. Successful responses include the data directly or wrapped in a `data` field for lists.

### Success Response

```json
{
  "id": "sess_abc123",
  "customer_email": "jane@example.com",
  "status": "active",
  "created_at": "2026-01-15T10:30:00Z"
}
```

### Error Response

```json
{
  "error": "Session not found."
}
```

## HTTP Status Codes

| Code | Description |
|------|-------------|
| `200` | Request succeeded |
| `201` | Resource created |
| `400` | Bad request -- invalid parameters or body |
| `401` | Unauthorized -- missing or invalid API key |
| `403` | Forbidden -- API key does not have access to this resource |
| `404` | Not found -- resource does not exist |
| `422` | Unprocessable entity -- validation failed |
| `500` | Internal server error |

## Rate Limits

API requests are rate-limited per API key:

| Plan | Rate Limit |
|------|------------|
| Free | 60 requests per minute |
| Pro | 300 requests per minute |
| Enterprise | 1,000 requests per minute |

When you exceed the rate limit, the API returns a `429` status with a `Retry-After` header indicating how many seconds to wait.

## Available Endpoints (Internal)

The following endpoints are currently available as internal API routes. These are subject to change and will be stabilized as part of the planned public API.

### Sessions

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/projects/:id/sessions` | List all feedback sessions |
| `GET` | `/api/projects/:id/sessions/:sessionId` | Get a specific session |

### Issues

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/projects/:id/issues` | List all issues |
| `GET` | `/api/projects/:id/issues/:issueId` | Get a specific issue |

### Customers

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/projects/:id/customers` | List all customers |
| `POST` | `/api/projects/:id/customers/import` | Import customers |

### Knowledge

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/projects/:id/settings/knowledge-sources` | List knowledge sources |
| `POST` | `/api/projects/:id/settings/knowledge-sources` | Add a knowledge source |

## Public API (Planned)

A public REST API with stable versioning, official SDKs, and comprehensive documentation is planned for a future release. This will include:

- Versioned endpoints (e.g., `/v1/sessions`)
- Official Node.js/TypeScript and Python SDK packages
- Webhook registration for event-driven integrations
- Stable request/response contracts with semantic versioning

Until the public API is available, use the internal endpoints above for programmatic access, keeping in mind that breaking changes may occur.
