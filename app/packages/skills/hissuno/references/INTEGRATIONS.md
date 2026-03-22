# Integrations

Connect external data sources to Hissuno via the CLI or dashboard.

## Supported Platforms

| Platform | Connection | Syncable | Description |
|----------|-----------|----------|-------------|
| Intercom | Token or OAuth | Yes | Customer conversations |
| Gong | Token | Yes | Sales call recordings |
| Zendesk | Token | Yes | Support tickets |
| Fathom | Token | Yes | Meeting recordings |
| HubSpot | Token or OAuth | Yes | CRM (companies and contacts) |
| Slack | OAuth | No | Workspace messages |
| GitHub | OAuth | No | Issues and PRs |
| Jira | OAuth | No | Issue tracking (auto-sync available) |
| Linear | OAuth | No | Issue tracking (auto-sync available) |
| Notion | Token or OAuth | No | Documentation |

**Syncable** platforms pull data on a schedule (manual, 1h, 6h, 24h). Non-syncable platforms use real-time hooks or manual import.

## Dashboard-Only Integrations

These integrations are configured through the Hissuno dashboard, not the CLI:
- Chat widget (embedded on your site)
- PostHog (product analytics)

## CLI Commands

### List all integrations

```bash
hissuno integrations list                        # Shows status of all 7 platforms
hissuno --json integrations list                 # JSON output
```

### Interactive setup

```bash
hissuno integrations <platform>                  # Interactive wizard: shows status, offers add/configure/sync/disconnect
```

### Direct actions

```bash
hissuno integrations status <platform>           # Detailed connection status
hissuno integrations add <platform>              # Connect (OAuth opens browser, token prompts for credentials)
hissuno integrations configure <platform>        # Update sync frequency or settings
hissuno integrations sync <platform>             # Trigger manual sync (syncable platforms only)
hissuno integrations sync <platform> --mode full # Full re-sync (vs incremental)
hissuno integrations disconnect <platform>       # Disconnect (with confirmation)
```

### Connection Options

Some platforms accept credentials directly (non-interactive):

**Gong:**
```bash
hissuno integrations add gong --access-key <key> --access-key-secret <secret> --base-url <url> --sync-frequency 24h
```

**Zendesk:**
```bash
hissuno integrations add zendesk --subdomain <sub> --email <email> --api-token <token> --sync-frequency 24h
```

**Intercom:**
```bash
hissuno integrations add intercom --access-token <token> --sync-frequency 24h
```

**Fathom:**
```bash
hissuno integrations add fathom --api-key <key> --sync-frequency 24h
```

**HubSpot:**
```bash
hissuno integrations add hubspot --access-token <token> --sync-frequency 24h --overwrite-policy fill_nulls
```

**Notion:**
```bash
hissuno integrations add notion --access-token <token>
```

## Status Details

Each platform returns different status fields when connected:

- **Intercom**: workspace name, auth method, sync frequency, last sync status, conversations synced
- **Gong**: sync frequency, last sync status, calls synced
- **Zendesk**: subdomain, account name, sync frequency, last sync status, tickets synced
- **Fathom**: sync frequency, last sync status, meetings synced
- **HubSpot**: hub name, auth method, sync frequency, overwrite policy, last sync status, companies/contacts synced
- **Slack**: workspace name, domain, installed by
- **GitHub**: account login, installed by
- **Jira**: site URL, project key, issue type, auto-sync status
- **Linear**: organization, team, auto-sync status
- **Notion**: workspace name, auth method
