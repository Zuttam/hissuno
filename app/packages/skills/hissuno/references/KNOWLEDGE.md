# Knowledge

Reference documents (websites, docs portals, Notion pages, uploaded files, raw text) attached to a product scope. Every entry lives under exactly one scope. The CLI accepts an optional `--scope`; when omitted, knowledge falls under the project's default (root) scope.

API path: `/api/product-scopes/[scopeId]/knowledge`

## Listing

```bash
hissuno list knowledge                            # Lists knowledge in the project's root scope
hissuno list knowledge --scope <scope-id>         # Lists knowledge in a specific scope
```

Returns all knowledge entries linked to the scope via `entity_relationships`.

## Detail

Knowledge entries don't have a top-level `hissuno get knowledge <id>`. To inspect a single entry, fetch it via the scope:

```bash
hissuno get scopes <scope-id>     # shows all linked knowledge + other relationships
```

## Creation

```bash
hissuno add knowledge --type <type> [--scope <id>] [...flags]
```

Required flags: `--type`. `--scope` is optional - when omitted the entry attaches to the project's default (root) scope. Knowledge types: `website`, `docs_portal`, `uploaded_doc`, `raw_text`, `notion`.

Type-specific fields:

| Type | Required Flag | Notes |
|------|---------------|-------|
| `website` | `--url` | Single page; fetched and analyzed |
| `docs_portal` | `--url` | Crawled (up to 50 pages) and analyzed |
| `raw_text` | `--content` | Inline markdown content |
| `notion` | (use dashboard) | Bulk import via Notion picker in the UI |
| `uploaded_doc` | (use dashboard) | File upload via UI |

```bash
hissuno add knowledge --type docs_portal --url https://docs.example.com           # Lands in the root scope
hissuno add knowledge --scope auth --type docs_portal --url https://docs.example.com/auth
hissuno add knowledge --scope billing --type raw_text --content "Pricing tier guidelines..."
```

## Search

Semantic vector search treats knowledge content as searchable text:

```bash
hissuno search "session expiry" --type knowledge
```

To narrow to a specific scope, traverse from the scope first:

```bash
hissuno get scopes auth     # see scope's linked knowledge
```

## Relationships

Knowledge entries link to exactly one product scope (their owning scope) via `entity_relationships`. They can also be referenced indirectly through other entities (issues, feedback) that share the same scope.

The underlying database table is still called `knowledge_sources`; the CLI/API surfaces it as `knowledge` because it is the canonical knowledge layer of a scope.

## CLI Examples

```bash
hissuno list knowledge                                                    # All root-scope knowledge
hissuno list knowledge --scope auth                                       # All auth-scope knowledge
hissuno add knowledge --type website --url https://...                    # Adds to the root scope
hissuno add knowledge --scope auth --type website --url https://...       # Adds to a specific scope
hissuno remove knowledge <id>                                             # Delete an entry
```

## See Also

- `references/PRODUCT-SCOPES.md` - managing the scopes that own knowledge
- `references/CODEBASES.md` - codebases as a separate first-class entity
