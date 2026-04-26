# Codebases

GitHub repositories registered with the project. Codebases are a first-class resource - independent of knowledge sources - with their own clone/sync lifecycle and (optional) scope linkage.

## Listing

```bash
hissuno list codebases
```

No filters. Returns all codebases registered in the project, with linked scope IDs.

## Detail

```bash
hissuno get codebase <id>
```

Returns the codebase row plus linked product scopes and sync metadata (commit SHA, last synced timestamp, branch).

## Creation

```bash
hissuno add codebase --repo <github-url> --branch <name> [--scope <slug>] [--name ...] [--description ...] [--analysis-scope <path>]
```

Required: `--repo`. Default branch is `main`.

- `--scope` links the codebase to a product scope; can be passed multiple times by repeating the flag is not supported in CLI yet, use the `PATCH /api/codebases/[id]` route to manage multi-scope linkage.
- `--analysis-scope` restricts code analysis to a path prefix (useful for monorepos).

Creating a codebase also triggers an immediate clone/sync.

```bash
hissuno add codebase --repo git@github.com:acme/api --branch main --scope auth --analysis-scope packages/auth-service
```

## Sync

```bash
hissuno sync codebase <id>
```

Pulls the latest commits for the configured branch. Updates `commit_sha` and `synced_at`. No-op if the local clone is already at the remote HEAD.

## Removal

```bash
hissuno remove codebase <id>
```

Drops the database row, cleans up the local clone, and cascades-deletes the codebase ↔ scope edges in `entity_relationships`.

## Relationships

Codebases link to product scopes via `entity_relationships.codebase_id` ↔ `product_scope_id`. They have no FK into `knowledge_sources` - the two are decoupled. Code retrieval at runtime happens via the codebase Mastra tools (file listing, file read, file search), not the knowledge embedding pipeline. Knowledge entries (under `/api/product-scopes/[scopeId]/knowledge`) are a separate resource for non-code reference docs.

## CLI Examples

```bash
hissuno list codebases                                                    # All codebases
hissuno get codebase <id>                                                 # Detail + linked scopes
hissuno add codebase --repo git@github.com:acme/api --scope auth          # Add and link to scope
hissuno sync codebase <id>                                                # Pull latest
hissuno remove codebase <id>                                              # Disconnect and clean up
```

## See Also

- `references/PRODUCT-SCOPES.md` — scopes that own / link to codebases
- `references/KNOWLEDGE.md` - non-code reference documents (separate model, scope-namespaced)
