# Admin Guide: Managing Invites & Promotions

This guide explains how to create invite codes and promotions for users via direct database operations.

---

## Prerequisites

- Access to Supabase dashboard or `psql` connection
- User IDs for the accounts you want to give invites to

---

## 1. Creating Invite Codes

### Generate a Random Code

Use this SQL function pattern to generate 8-character alphanumeric codes:

```sql
-- Generate a single random code
SELECT upper(substr(md5(random()::text), 1, 8));
```

### Add Invite for a Single User

```sql
INSERT INTO invites (code, owner_user_id)
VALUES (
  upper(substr(md5(random()::text), 1, 8)),  -- auto-generated code
  'USER_UUID_HERE'
);
```

### Add Multiple Invites for One User

```sql
-- Give user 3 invite codes
INSERT INTO invites (code, owner_user_id)
SELECT
  upper(substr(md5(random()::text || generate_series::text), 1, 8)),
  'USER_UUID_HERE'
FROM generate_series(1, 3);
```

### Add Invites for All Existing Users

```sql
-- Give every user 2 invite codes each
INSERT INTO invites (code, owner_user_id)
SELECT
  upper(substr(md5(random()::text || u.id::text || s.n::text), 1, 8)),
  u.id
FROM auth.users u
CROSS JOIN generate_series(1, 2) AS s(n);
```

### Add Invites for Specific Users (by email)

```sql
-- Give invites to specific users
INSERT INTO invites (code, owner_user_id)
SELECT
  upper(substr(md5(random()::text || u.id::text), 1, 8)),
  u.id
FROM auth.users u
WHERE u.email IN (
  'user1@example.com',
  'user2@example.com',
  'user3@example.com'
);
```

### Add Invite with Custom Code

```sql
INSERT INTO invites (code, owner_user_id)
VALUES ('WELCOME1', 'USER_UUID_HERE');
```

### Add Invite with Expiration

```sql
INSERT INTO invites (code, owner_user_id, expires_at)
VALUES (
  'TEMP2024',
  'USER_UUID_HERE',
  '2024-12-31 23:59:59+00'  -- expires end of 2024
);
```

---

## 2. Creating Promotions

Promotions are typically created automatically when an invite is claimed. However, you can manually create them.

### Promotion Types

| Type | Value Meaning | Example |
|------|---------------|---------|
| `referral_credit` | Cents (USD) | `500` = $5.00 |
| `discount_percent` | Percentage | `20` = 20% off |
| `free_month` | Number of months | `1` = 1 free month |

### Promotion Statuses

| Status | Meaning |
|--------|---------|
| `pending` | Waiting for invitee to subscribe |
| `eligible` | Invitee subscribed, reward available |
| `claimed` | Reward has been applied |
| `expired` | Reward expired before claiming |

### Add a Manual Promotion

```sql
-- First, find the invite ID
SELECT id, code FROM invites WHERE owner_user_id = 'USER_UUID_HERE';

-- Then create the promotion
INSERT INTO promotions (user_id, invite_id, type, value, status)
VALUES (
  'USER_UUID_HERE',           -- user receiving the promotion
  'INVITE_UUID_HERE',         -- linked invite
  'referral_credit',          -- type
  500,                        -- $5.00 in cents
  'eligible'                  -- immediately eligible
);
```

### Give All Users a Welcome Credit

```sql
-- Create a "system" invite for tracking, then promotions
-- Note: This requires a system/admin user ID for the invite owner

INSERT INTO promotions (user_id, invite_id, type, value, status, eligible_at)
SELECT
  u.id,
  'SYSTEM_INVITE_UUID',  -- create a placeholder invite first
  'referral_credit',
  1000,                  -- $10.00 welcome credit
  'eligible',
  NOW()
FROM auth.users u
WHERE u.id NOT IN (SELECT user_id FROM promotions WHERE type = 'referral_credit');
```

---

## 3. Querying Invites & Promotions

### View All Invites for a User

```sql
SELECT
  i.code,
  i.created_at,
  i.claimed_at,
  i.expires_at,
  claimer.email AS claimed_by_email
FROM invites i
LEFT JOIN auth.users claimer ON claimer.id = i.claimed_by_user_id
WHERE i.owner_user_id = 'USER_UUID_HERE'
ORDER BY i.created_at DESC;
```

### View Unclaimed Invites

```sql
SELECT
  i.code,
  owner.email AS owner_email,
  i.created_at,
  i.expires_at
FROM invites i
JOIN auth.users owner ON owner.id = i.owner_user_id
WHERE i.claimed_by_user_id IS NULL
  AND (i.expires_at IS NULL OR i.expires_at > NOW())
ORDER BY i.created_at DESC;
```

### View All Promotions

```sql
SELECT
  u.email,
  p.type,
  p.value,
  p.status,
  p.created_at,
  p.eligible_at,
  p.claimed_at
FROM promotions p
JOIN auth.users u ON u.id = p.user_id
ORDER BY p.created_at DESC;
```

### View Pending Promotions (waiting for invitee to subscribe)

```sql
SELECT
  owner.email AS inviter_email,
  claimer.email AS invitee_email,
  p.type,
  p.value,
  p.created_at
FROM promotions p
JOIN auth.users owner ON owner.id = p.user_id
JOIN invites i ON i.id = p.invite_id
JOIN auth.users claimer ON claimer.id = i.claimed_by_user_id
WHERE p.status = 'pending';
```

---

## 4. Maintenance

### Delete Expired Unclaimed Invites

```sql
DELETE FROM invites
WHERE expires_at < NOW()
  AND claimed_by_user_id IS NULL;
```

### Expire Old Pending Promotions

```sql
UPDATE promotions
SET status = 'expired', expires_at = NOW()
WHERE status = 'pending'
  AND created_at < NOW() - INTERVAL '90 days';
```

### Revoke Unclaimed Invites for a User

```sql
DELETE FROM invites
WHERE owner_user_id = 'USER_UUID_HERE'
  AND claimed_by_user_id IS NULL;
```

---

## 5. Quick Reference

### Find User ID by Email

```sql
SELECT id, email FROM auth.users WHERE email = 'user@example.com';
```

### Count Invites per User

```sql
SELECT
  u.email,
  COUNT(*) FILTER (WHERE i.claimed_by_user_id IS NULL) AS available,
  COUNT(*) FILTER (WHERE i.claimed_by_user_id IS NOT NULL) AS claimed
FROM auth.users u
LEFT JOIN invites i ON i.owner_user_id = u.id
GROUP BY u.id, u.email
ORDER BY available DESC;
```
