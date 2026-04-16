# Feedback Sessions

Customer feedback sessions - conversations from chat widgets, Slack, Intercom, Gong, and other sources.

## Listing

| Filter | CLI Option | Values |
|--------|-----------|--------|
| source | `--source <source>` | `widget`, `slack`, `intercom`, `gong`, `api`, `manual` |
| status | `--status <status>` | `active`, `closing_soon`, `awaiting_idle_response`, `closed` |
| tags | `--tags <tags>` | Comma-separated tag list |
| contact_id | `--contact-id <id>` | Contact UUID |
| search | `--search <query>` | Full-text search within feedback content |

## Detail

`hissuno get feedback <id>` returns:

- Session metadata: name, source, status, tags, message count
- Full conversation messages (role + content)
- Page URL and title (for widget sessions)
- Lifecycle timestamps (first message, last activity, close time)
- **Relationships** - linked contacts, companies, issues, knowledge sources, product scopes

## Search

Semantic vector search. Falls back to full-text search for sessions that have not been analyzed/embedded yet.

```bash
hissuno search "checkout flow" --type feedback
```

## Creation

```bash
hissuno add feedback
```

Interactive prompts:
1. Messages (loop: select role `user`/`assistant` + enter content, empty to finish)
2. Name/title (optional)
3. Tags (optional, comma-separated)


## Relationships

Feedback sessions connect to:
- **Contacts** - who sent the feedback
- **Companies** - via the contact's company
- **Issues** - bugs or requests surfaced from this conversation
- **Knowledge sources** - referenced documentation or code
- **Product scopes** - the product area this feedback relates to

## CLI Examples

```bash
hissuno list feedback --source intercom --status closed
hissuno list feedback --contact-id <uuid> --limit 5
hissuno get feedback <id>
hissuno add feedback
```
