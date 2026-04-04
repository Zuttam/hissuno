---
title: "API Authentication"
description: "Generate and manage API keys for authenticating with the Hissuno REST API."
---

## Overview

The Hissuno API uses API keys for authentication. Each key is scoped to a single project and carries the permissions of the user who created it. All API requests must include a valid key in the `Authorization` header.

## Generating an API Key

### From the Dashboard

1. Navigate to the **Access** page in the sidebar
2. Click **Generate API Key**
3. Enter a descriptive name for the key (e.g., "Production Widget", "CI Integration")
4. Select the key permissions (see permissions section below)
5. Click **Create Key**
6. Copy the key immediately -- it will not be shown again

The key is displayed only once at creation time. Store it securely in your environment variables or secrets manager.

### Key Format

Hissuno API keys use the prefix `hss_` followed by a random string:

```
hss_k1_a3b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5
```

The prefix identifies the key as a Hissuno API key and helps prevent accidental use in the wrong context.

## Authorization Header

Include the API key in every request using the `Authorization` header with the `Bearer` scheme:

```bash
curl -X GET /api/projects/:projectId/sessions \
  -H "Authorization: Bearer hss_k1_a3b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5"
```

### Common Mistakes

**Missing Bearer prefix** -- The key must be preceded by `Bearer `:

```bash
# Correct
Authorization: Bearer hss_k1_abc123

# Incorrect -- will return 401
Authorization: hss_k1_abc123
```

**Key in URL parameters** -- Never pass the API key as a query parameter. This exposes the key in server logs, browser history, and referrer headers:

```bash
# Incorrect -- never do this
/api/projects/:projectId/sessions?api_key=hss_k1_abc123
```

## Key Permissions

When creating an API key, you can assign one of the following permission levels:

| Permission | Read | Write | Delete | Use Case |
|------------|------|-------|--------|----------|
| Read-only | Yes | No | No | Dashboards, reporting tools |
| Standard | Yes | Yes | No | Widget integration, automations |
| Full access | Yes | Yes | Yes | Admin scripts, data management |

### Permission Details

**Read-only** keys can:
- List and retrieve sessions, issues, customers, and knowledge entries
- Access analytics and aggregate data

**Standard** keys can additionally:
- Create sessions and send messages
- Create and update customers
- Add knowledge entries
- Register webhooks

**Full access** keys can additionally:
- Delete sessions, knowledge entries, and webhooks
- Modify project settings via the API

## Key Rotation

### Why Rotate Keys

Regular key rotation limits the exposure window if a key is compromised. Recommended rotation schedules:

| Environment | Rotation Frequency |
|-------------|-------------------|
| Production | Every 90 days |
| Staging | Every 30 days |
| Development | As needed |

### How to Rotate

1. Generate a new API key with the same permissions as the old one
2. Update your application configuration to use the new key
3. Deploy the configuration change
4. Verify that API requests succeed with the new key
5. Revoke the old key

This process ensures zero downtime during rotation.

### Revoking a Key

To revoke a key immediately:

1. Navigate to the **Access** page in the sidebar
2. Find the key in the list
3. Click the **Revoke** button
4. Confirm the revocation

Revoked keys return a `401 Unauthorized` response immediately. Revocation cannot be undone -- you must generate a new key if needed.

## Security Best Practices

### Store Keys Securely

Never hardcode API keys in source code. Use environment variables or a secrets manager:

```bash
# Environment variable
export HISSUNO_API_KEY=hss_k1_a3b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5
```

```typescript
// Access from environment
const apiKey = process.env.HISSUNO_API_KEY;
```

### Use Least-Privilege Permissions

Create keys with the minimum permissions required for their use case. A reporting dashboard only needs read-only access. A widget integration needs standard access. Reserve full access keys for administrative tasks.

### Separate Keys by Environment

Use distinct API keys for development, staging, and production environments. This limits the blast radius if any single key is compromised and makes it easier to revoke a key without affecting other environments.

### Monitor Key Usage

Review API key activity in the dashboard:

Navigate to the **Access** page in the sidebar to review key usage.

The usage log shows:

- Requests per key over time
- Most-used endpoints per key
- Error rates per key
- Last used timestamp

Unusual activity (sudden spikes, unexpected endpoints, high error rates) may indicate a compromised key.

### Git and CI/CD

Ensure API keys are excluded from version control:

```gitignore
# .gitignore
.env
.env.local
.env.production
```

In CI/CD pipelines, use the platform's secrets management:

```yaml
# GitHub Actions example
env:
  HISSUNO_API_KEY: ${{ secrets.HISSUNO_API_KEY }}
```

## Troubleshooting

### 401 Unauthorized

If you receive a `401` response:

- Verify the `Authorization` header includes the `Bearer` prefix
- Check that the API key has not been revoked
- Confirm the key belongs to the correct project
- Ensure there are no extra spaces or characters in the header value

### 403 Forbidden

A `403` response means the key is valid but lacks permission for the requested action:

- Check the key's permission level on the **Access** page
- Generate a new key with the required permissions if needed
