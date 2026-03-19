# Issues

Product issues - bugs, feature requests, and change requests tracked from customer feedback.

## Listing

| Filter | CLI Option | Values |
|--------|-----------|--------|
| type | `--issue-type <type>` | `bug`, `feature_request`, `change_request` |
| priority | `--priority <priority>` | `low`, `medium`, `high` |
| status | `--status <status>` | `open`, `ready`, `in_progress`, `resolved`, `closed` |
| search | `--search <query>` | Text search within title and description |

The API also accepts `productScopeIds` (comma-separated UUIDs) and `goalId` filters, but these are not yet exposed as CLI options. Use `--json` with the API directly if you need scope-filtered issue lists.

## Detail

`hissuno get issues <id>` returns:

- Title, description, type, priority, status
- RICE scores (reach, impact, confidence, effort) when computed
- Impact analysis and brief (when generated)
- Upvote count
- **Relationships** - linked feedback sessions, contacts, companies, knowledge sources, product scopes

## Search

Semantic vector search for finding similar issues by meaning.

```bash
hissuno search "login failures" --type issues
```

## Creation

```bash
hissuno add issues
```

Interactive prompts:
1. Type (bug / feature request / change request)
2. Title
3. Description
4. Priority (optional: low / medium / high)

**MCP add fields:**

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `type` | Yes | string | `bug`, `feature_request`, or `change_request` |
| `title` | Yes | string | Issue title |
| `description` | Yes | string | Detailed description |
| `priority` | No | string | `low`, `medium`, or `high` |

## Relationships

Issues connect to:
- **Feedback sessions** - conversations that surfaced this issue
- **Contacts** - customers who reported or are affected
- **Companies** - organizations impacted
- **Knowledge sources** - relevant code or documentation
- **Product scopes** - the product area or initiative this issue belongs to (with optional goal alignment)

## CLI Examples

```bash
hissuno list issues --status open --priority high
hissuno list issues --issue-type bug
hissuno get issues <id>
hissuno search "payment timeout" --type issues
hissuno add issues
```
