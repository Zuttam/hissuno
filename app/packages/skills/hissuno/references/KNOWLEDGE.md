# Knowledge Sources

Analyzed knowledge sources - codebases, documents, and URLs that have been processed into searchable chunks.

## Listing

No filters available. `hissuno list knowledge` returns all knowledge sources.

## Detail

`hissuno get knowledge <id>` returns:

- Name, type (codebase, document, URL), status
- Processing metadata (chunk count, last analyzed)
- **Relationships** - linked issues, feedback sessions, product scopes, contacts, companies

## Search

Semantic vector search across all knowledge chunks. Matches by meaning, not exact text.

```bash
hissuno search "authentication flow" --type knowledge
```

## Creation

Not supported via CLI or MCP. Add knowledge sources through the Hissuno dashboard.

## Relationships

Knowledge sources connect to all other entity types in the graph. Common connections:
- **Issues** - bugs or feature requests referencing this codebase/doc
- **Product scopes** - the product area this knowledge belongs to
- **Feedback sessions** - customer conversations that reference this knowledge

## CLI Examples

```bash
hissuno list knowledge                           # List all sources
hissuno get knowledge <id>                       # Full details + relationships
hissuno search "payment processing" --type knowledge  # Semantic search
```
