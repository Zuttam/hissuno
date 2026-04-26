# Relationship Graph Traversal

Hissuno stores all data in an interconnected relationship graph. Every entity can link to any other entity via universal edges, enabling rich cross-entity queries.

## Entity Types

| Entity Type | CLI Type | Description |
|-------------|----------|-------------|
| `company` | `customers --customer-type companies` | Customer organizations |
| `contact` | `customers` (default) | Individual people |
| `issue` | `issues` | Bugs, features, change requests |
| `session` | `feedback` | Feedback conversations |
| `knowledge_source` | `knowledge` (scope-namespaced) | Reference docs (URLs, Notion, files, raw text) |
| `codebase` | `codebase` | GitHub repositories |
| `product_scope` | `scopes` | Product areas and initiatives |

## Reading Relationships

Every `hissuno get <type> <id>` call returns a `relationships` section showing all connected entities, grouped by type:

```
Related Entities:
  Companies (2): Acme Corp, Globex Inc
  Contacts (3): Jane Doe, John Smith, Alex Chen
  Issues (1): Login timeout on mobile
  Product Scopes (1): API Platform
```

With `--json`, relationships appear as:
```json
{
  "relationships": {
    "companies": [{"id": "...", "name": "Acme Corp", "domain": "acme.com"}],
    "contacts": [{"id": "...", "name": "Jane Doe", "email": "jane@acme.com"}],
    "issues": [{"id": "...", "title": "Login timeout", "type": "bug", "status": "open"}],
    "sessions": [],
    "knowledgeSources": [],
    "productScopes": [{"id": "...", "name": "API Platform"}]
  }
}
```

## Filtering by Relationship

Some `list` commands accept relationship-based filters:

| Command | Filter | Description |
|---------|--------|-------------|
| `hissuno list feedback` | `--contact-id <id>` | Feedback from a specific contact |
| `hissuno list customers` | `--company-id <id>` | Contacts at a specific company |

The API supports additional relationship filters (`productScopeIds`, `goalId` on issues) not yet exposed in the CLI.

## Common Traversal Patterns

### Issues in a product area

1. `hissuno list scopes` - find the scope ID
2. `hissuno get scopes <id>` - check relationships.issues

Or via API: `GET /api/issues?productScopeIds=<id>` for filtered listing.

### Feedback from a specific company's contacts

1. `hissuno list customers --company-id <id>` - find contacts at the company
2. For each contact: `hissuno list feedback --contact-id <id>`

### Issues aligned with a goal

1. `hissuno list scopes` - find the scope, note the goal ID
2. Via API: `GET /api/issues?goalId=<goalId>` (not yet in CLI)
3. Alternative: `hissuno get scopes <id>` and check relationships.issues

### Companies affected by an issue

1. `hissuno get issues <id>` - check relationships.companies (shown in related entities)

### Full picture for a contact

1. `hissuno get customers <id>` - returns all relationships in one call:
   - Company they belong to
   - Feedback sessions they created
   - Issues they reported
   - Product scopes they engage with

### Trace feedback to product impact

1. `hissuno get feedback <id>` - note related issues and product scopes
2. `hissuno get issues <id>` for each linked issue - see priority, RICE scores
3. `hissuno get scopes <id>` for the product area - see goals and other related issues

## Tips

- Always use `--json` when building multi-step traversals programmatically
- `get` is the primary traversal tool - it returns all relationships in one call
- For large result sets, use `--limit` to control pagination
- Entity IDs are UUIDs - pass them exactly between commands
