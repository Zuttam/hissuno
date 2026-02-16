---
title: "Widget API"
description: "API endpoints for the Hissuno embeddable support widget, including session creation, streaming responses, and session lifecycle."
---

## Overview

The Widget API powers the Hissuno embeddable support widget. It provides endpoints for creating customer support sessions, streaming AI-powered responses in real time, and managing session lifecycle.

The Widget API uses API key authentication. See the [Authentication](/docs/api/authentication) page for details on managing keys from the **Access** page.

## Endpoints

### Create a Session / Send a Message

Start a new support conversation or send a message within an existing session.

```
POST /api/integrations/widget/chat
```

**Request body:**

```json
{
  "projectId": "proj_abc123",
  "sessionId": null,
  "customer": {
    "email": "jane@acme.com",
    "name": "Jane Doe"
  },
  "message": "How do I export my data as a CSV?"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `projectId` | string | Yes | Your Hissuno project ID |
| `sessionId` | string | No | Existing session ID to continue a conversation; omit or pass `null` to create a new session |
| `customer` | object | Yes | Customer identification with `email` and optional `name` |
| `message` | string | Yes | The customer's message text |

**Response (200):**

Returns the session ID and an acknowledgment. The AI response is delivered via the streaming endpoint.

### Stream Responses

Receive AI Support Agent responses in real time via Server-Sent Events (SSE).

```
GET /api/integrations/widget/chat/stream
```

This endpoint opens an SSE connection. The Support Agent processes the customer's message and streams its response as a series of events.

**Event types:**

| Event | Description |
|-------|-------------|
| `connected` | SSE connection established |
| `token` | Incremental text token from the agent's response |
| `complete` | Agent response is complete |
| `error` | An error occurred during processing |

**Example SSE stream:**

```
event: connected
data: {"message": "Connected"}

event: token
data: {"content": "You can "}

event: token
data: {"content": "export your data "}

event: token
data: {"content": "from the Settings page."}

event: complete
data: {"message": "Done"}
```

### Close a Session

Close an active support session.

```
POST /api/integrations/widget/chat/close
```

**Request body:**

```json
{
  "projectId": "proj_abc123",
  "sessionId": "sess_abc123"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `projectId` | string | Yes | Your Hissuno project ID |
| `sessionId` | string | Yes | The session to close |

Closing a session marks it as complete and triggers the PM Agent to review the conversation for product feedback.

## Session Lifecycle

Sessions move through the following statuses:

| Status | Description |
|--------|-------------|
| `active` | The session is open and the customer can send messages |
| `closing_soon` | The session is about to close due to inactivity |
| `awaiting_idle_response` | The session is waiting for a final response before closing |
| `closed` | The session is complete; no further messages are accepted |

Sessions transition through these states based on customer activity and explicit close requests.

## Message Roles

Messages within a session use the following roles:

| Role | Description |
|------|-------------|
| `user` | A message from the customer |
| `assistant` | A response from the AI Support Agent |
| `system` | A system-generated message (e.g., session status changes) |

## Widget Integration

The Hissuno widget (`@hissuno/widget`) handles the communication protocol automatically. If you are building a custom integration, use the endpoints above to replicate the widget's behavior:

1. Call `/api/integrations/widget/chat` with the customer's message and project ID
2. Open an SSE connection to `/api/integrations/widget/chat/stream` to receive the agent's response
3. Repeat for each message in the conversation
4. Call `/api/integrations/widget/chat/close` when the conversation is finished

## Error Handling

All endpoints return standard HTTP error codes:

| Code | Description |
|------|-------------|
| `400` | Bad request -- missing required fields or invalid data |
| `401` | Unauthorized -- missing or invalid API key |
| `404` | Not found -- session or project does not exist |
| `500` | Internal server error |

Error responses include a JSON body with an `error` field describing the problem:

```json
{
  "error": "Session not found."
}
```
