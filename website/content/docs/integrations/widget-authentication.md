---
title: "Widget Authentication"
description: "Secure your Hissuno widget with JWT-based authentication, server-side token generation, and origin restrictions."
---

## Overview

By default, any visitor with your `projectId` can start a conversation. For production, enable **token authentication** to verify requests originate from your application. Authentication uses a **JWT** signed with your project's secret key, generated on your backend and passed to the widget.

## Enabling Token Authentication

1. Open your project in the Hissuno dashboard.
2. Navigate to **Settings > Widget > Security**.
3. Enable **Require widget token**.
4. Copy your **Secret Key** (format: `sk_live_...`). Never expose it in client-side code.

Once enabled, widget requests without a valid token receive a `401` response.

## Generating Tokens Server-Side

The token must be signed with `HS256` using your project's secret key.

### Node.js / Express

```js
const jwt = require('jsonwebtoken');

app.get('/api/hissuno-token', (req, res) => {
  const token = jwt.sign(
    {
      userId: req.user.id,
      userMetadata: { name: req.user.name, email: req.user.email },
    },
    process.env.HISSUNO_SECRET_KEY,
    { algorithm: 'HS256', expiresIn: '24h' }
  );
  res.json({ token });
});
```

### Next.js API Route

```ts
import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';

export async function GET() {
  const user = await auth(); // your auth helper
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const token = jwt.sign(
    { userId: user.id, userMetadata: { name: user.name, email: user.email } },
    process.env.HISSUNO_SECRET_KEY!,
    { algorithm: 'HS256', expiresIn: '24h' }
  );
  return NextResponse.json({ token });
}
```

### Python / Flask

```python
import jwt, os
from datetime import datetime, timedelta, timezone

@app.route("/api/hissuno-token")
def hissuno_token():
    token = jwt.encode(
        {
            "userId": g.user["id"],
            "userMetadata": {"name": g.user["name"]},
            "exp": datetime.now(timezone.utc) + timedelta(hours=24),
        },
        os.environ["HISSUNO_SECRET_KEY"],
        algorithm="HS256",
    )
    return jsonify({"token": token})
```

## JWT Payload

| Field          | Type                     | Required | Description                               |
|----------------|--------------------------|----------|-------------------------------------------|
| `userId`       | `string`                 | Yes      | Unique identifier for the end-user        |
| `userMetadata` | `Record<string, string>` | No       | User info visible in the dashboard        |
| `iat`          | `number`                 | Auto     | Issued-at timestamp (set by jwt.sign)     |
| `exp`          | `number`                 | Auto     | Expiration timestamp                      |

The server allows up to 60 seconds of clock skew.

## Passing the Token to the Widget

```tsx
import { useEffect, useState } from 'react';
import { HissunoWidget } from '@hissuno/widget';

function App() {
  const [token, setToken] = useState<string>();

  useEffect(() => {
    fetch('/api/hissuno-token')
      .then((res) => res.json())
      .then((data) => setToken(data.token));
  }, []);

  return (
    <HissunoWidget
      projectId="your-project-id"
      widgetToken={token}
      userId={currentUser.id}
      userMetadata={{ name: currentUser.name }}
    />
  );
}
```

## Anonymous vs Authenticated Sessions

| Aspect               | Anonymous                    | Authenticated                          |
|----------------------|------------------------------|----------------------------------------|
| Token required       | No                           | Yes (`widgetToken` prop)               |
| User identity        | Optional via `userId` prop   | Verified via JWT `userId` claim        |
| Session history      | Available if `userId` set    | Available (userId from token)          |
| Security             | Origin-restricted only       | Origin + token verification            |
| Dashboard visibility | Anonymous visitor            | Identified user with metadata          |

Without token auth, `userId` and `userMetadata` are client-provided and cannot be trusted for security. Token authentication cryptographically verifies the user identity.

## Origin Restrictions

Configure allowed origins in **Settings > Widget > Security**:

- **Empty list** -- All origins are permitted (development mode).
- **Exact origins** -- `https://myapp.com` for precise matching.
- **Wildcards** -- `*.myapp.com` to allow all subdomains.

When a request comes from a blocked origin, the widget does not render and logs a console warning.

## Token Refresh

Tokens expire based on the `expiresIn` value you set (recommended: 24 hours). For long-lived sessions, set up a periodic refresh using `setInterval` to fetch a new token from your backend before the current one expires.

## Security Checklist

- Store your secret key in environment variables. Never commit it to source control.
- Generate tokens exclusively on your backend.
- Set a reasonable expiration (24 hours recommended).
- Configure allowed origins for production.
- Enable "Require widget token" before going live.
- Rotate your secret key via the dashboard when needed. This invalidates all existing tokens.
