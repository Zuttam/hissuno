# Integrations

Connect external data sources to Hissuno via the CLI or dashboard.

## Supported Platforms

| Platform | Connection | Syncable | Description |
|----------|-----------|----------|-------------|
| Intercom | Token or OAuth | Yes | Customer conversations |
| Gong | Token | Yes | Sales call recordings |
| Zendesk | Token | Yes | Support tickets |
| Slack | OAuth | No | Workspace messages |
| GitHub | OAuth | No | Issues and PRs |
| Jira | OAuth | No | Issue tracking (auto-sync available) |
| Linear | OAuth | No | Issue tracking (auto-sync available) |

**Syncable** platforms pull data on a schedule (manual, 1h, 6h, 24h). Non-syncable platforms use real-time hooks or manual import.

## Dashboard-Only Integrations

These integrations are configured through the Hissuno dashboard, not the CLI:
- Chat widget (embedded on your site)
- PostHog (product analytics)
- HubSpot (CRM)
- Fathom (meeting recordings)
- Notion (documentation)

## CLI Commands

### List all integrations

```bash
hissuno integrate                                # Shows status of all 7 platforms
hissuno integrate --json                         # JSON output
```

### Interactive setup

```bash
hissuno integrate <platform>                     # Interactive wizard: shows status, offers connect/configure/sync/disconnect
```

### Direct actions

```bash
hissuno integrate <platform> status              # Detailed connection status
hissuno integrate <platform> connect             # Connect (OAuth opens browser, token prompts for credentials)
hissuno integrate <platform> configure           # Update sync frequency or settings
hissuno integrate <platform> sync                # Trigger manual sync (syncable platforms only)
hissuno integrate <platform> sync --mode full    # Full re-sync (vs incremental)
hissuno integrate <platform> disconnect          # Disconnect (with confirmation)
```

### Connection Options

Some platforms accept credentials directly (non-interactive):

**Gong:**
```bash
hissuno integrate gong connect --access-key <key> --access-key-secret <secret> --base-url <url> --sync-frequency 24h
```

**Zendesk:**
```bash
hissuno integrate zendesk connect --subdomain <sub> --email <email> --api-token <token> --sync-frequency 24h
```

**Intercom:**
```bash
hissuno integrate intercom connect --access-token <token> --sync-frequency 24h
```

## Status Details

Each platform returns different status fields when connected:

- **Intercom**: workspace name, auth method, sync frequency, last sync status, conversations synced
- **Gong**: sync frequency, last sync status, calls synced
- **Zendesk**: subdomain, account name, sync frequency, last sync status, tickets synced
- **Slack**: workspace name, domain, installed by
- **GitHub**: account login, installed by
- **Jira**: site URL, project key, issue type, auto-sync status
- **Linear**: organization, team, auto-sync status
