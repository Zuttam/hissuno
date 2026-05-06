# Third-Party Plugins

## Context

Every Hissuno integration is a `PluginDef` object produced by `definePlugin(...)` in `app/src/lib/integrations/plugins/<id>.ts` and registered in a static import list at `app/src/lib/integrations/registry.ts`. The contract is already well-isolated - plugins never touch the DB directly, they only call `ctx.ingest.*` primitives - but the registry is hard-coded, so a developer shipping a new integration must fork the repo.

Goal: let a developer build a plugin out of tree (npm package or local directory), install it into a self-hosted Hissuno, and have it behave exactly like a built-in - appearing in the marketplace, receiving OAuth callbacks and webhooks, getting scheduled by cron, and streaming data through the ingestion pipeline.

### Non-goals (deferred)

- Public plugin marketplace / discovery UI.
- Custom React `ConfigDialog` components from external packages. Next.js bundling makes this invasive; external plugins use the auto-generated config dialog.
- Hot-reload `hissuno plugin dev` command.

### Chosen approach: Extract plugin-kit + pluggable registry

Three concrete pieces:

1. **Extract `@hissuno/plugin-kit` as a publishable package.** The type contract external code depends on. Lives at `app/packages/plugin-kit/` alongside `packages/cli/` and `packages/widget/`.
2. **Pluggable registry.** The app loads first-party plugins statically (unchanged) and merges in third-party plugins listed in a manifest (env var or config file) via dynamic `await import()` at server boot.
3. **CLI scaffolding + docs.** `hissuno plugin init <name>` generates a working plugin package. New docs page walks through build / install / test.

### Why this shape

- The coupling is the static import list, not anything deeper. Every route already goes through `getPlugin(id)` - swap the lookup source and the rest is transparent.
- `plugin-kit.ts` imports only `next/server` (NextRequest type), React types (optional UI), and zod. Easy to package with `next` and `react` as peer dependencies.
- Icons are static `/logos/*.svg` files in `app/public/logos/` - third-party plugins can't write there, so external plugins standardize on **data-URI or absolute-URL** icons. `PluginIcon.src` accepts both already; no kit change needed.

---

## User Experience

### Developer workflow

```bash
$ hissuno plugin init my-integration
? Plugin id: my-integration
? Display name: My Integration
? Auth type: (oauth2 / api_key / custom)
? First stream kind: (sessions / issues / knowledge / ...)

Created ./my-integration with a working skeleton.

  cd my-integration
  npm install
  npm run build
```

### Self-hoster workflow

```bash
# Install the plugin into the Hissuno app
cd /srv/hissuno/app
npm install @acme/hissuno-widgets

# Register it
export HISSUNO_PLUGINS="@acme/hissuno-widgets"
npm run start
```

Or commit `app/hissuno.plugins.json`:
```json
{ "plugins": ["@acme/hissuno-widgets", "./packages/internal-plugin"] }
```

### Plugin author surface

```typescript
import { definePlugin } from '@hissuno/plugin-kit'

export default definePlugin({
  id: 'my-integration',
  name: 'My Integration',
  // ... same contract as today
})
```

---

## Design

### 1. Extract plugin-kit package

**New directory `app/packages/plugin-kit/`** (mirror the `packages/cli/` layout):
- `package.json` - name `@hissuno/plugin-kit`, peer deps: `next`, `react`, `zod`. Built with tsup.
- `tsconfig.json`, `tsup.config.ts`.
- `src/index.ts` - move the contents of `app/src/lib/integrations/plugin-kit.ts` here verbatim. No logic change.
- `README.md` - minimal, points to the website docs.

**Modify `app/src/lib/integrations/plugin-kit.ts`** -> replace entire contents with `export * from '@hissuno/plugin-kit'`. Every internal plugin keeps compiling unchanged.

**Modify `app/package.json`** -> add `"@hissuno/plugin-kit": "file:./packages/plugin-kit"` under dependencies (same pattern as `@hissuno/widget`).

### 2. Pluggable registry

**Modify `app/src/lib/integrations/registry.ts`:**
- Keep the `ALL_PLUGINS` array of first-party plugins.
- Change the internal store from a frozen `Record` to a mutable `Map<string, PluginDef>`; `getPlugin` / `listPlugins` read from it.
- Export `registerPlugin(def)` - throws if the id already exists (prevents silent overrides of first-party plugins).
- Export `unregisterPlugin(id)`.

**New file `app/src/lib/integrations/external-loader.ts`:**
- `loadExternalPlugins()` - reads the manifest, dynamically imports each package via `(0, eval)('import')(name)` (bypasses the Next.js bundler), validates the default export is a `PluginDef`, calls `registerPlugin`.
- Manifest source (in order of precedence):
  1. `HISSUNO_PLUGINS` env var - comma-separated package names or relative paths.
  2. `app/hissuno.plugins.json` - `{ "plugins": [...] }` checked in by self-hosters.
- Each failed import is logged but non-fatal - one broken external plugin must not take down the server.

**New file `app/src/instrumentation.ts`** - Next.js's official hook for server-boot code. Exports `register()` which calls `loadExternalPlugins()` once when the Node.js server starts.

### 3. CLI scaffolding

**New file `app/packages/cli/src/commands/plugin.ts`:**
- `hissuno plugin init <name>` - prompts for id, display name, auth type, stream kind; scaffolds a new directory with `package.json`, `tsconfig.json`, `tsup.config.ts`, `src/index.ts` (a `definePlugin(...)` skeleton matching the chosen auth/stream types).
- `hissuno plugin validate <path>` - loads a plugin module, runs `definePlugin`'s validation (reuse the existing id/stream-key regex checks at `plugin-kit.ts:526`), reports issues.

**Modify `app/packages/cli/src/index.ts`** - register the new command group.

### 4. Docs

**New file `website/content/docs/integrations/plugin-development.md`:**
- "Building your first plugin" walkthrough.
- Installing `@hissuno/plugin-kit`, scaffolding with `hissuno plugin init`, implementing `sync`, adding to `HISSUNO_PLUGINS`, verifying in the marketplace.
- Conventions for third-party plugins: icon as data-URI, no DB imports, no custom React dialogs (for now).

**Modify `website/content/docs/integrations/plugin-architecture.md`** - add a "Third-party plugins" section after "Registering a Plugin" pointing to the new doc and documenting the `HISSUNO_PLUGINS` env var.

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `app/packages/plugin-kit/` | **New** workspace package - move of current `plugin-kit.ts` |
| `app/src/lib/integrations/plugin-kit.ts` | Replace with `export * from '@hissuno/plugin-kit'` |
| `app/src/lib/integrations/registry.ts` | Mutable Map store + `registerPlugin` / `unregisterPlugin` |
| `app/src/lib/integrations/external-loader.ts` | **New** - manifest-driven dynamic loader |
| `app/src/instrumentation.ts` | **New** - server-boot `register()` calls loader |
| `app/package.json` | Add `@hissuno/plugin-kit` file dependency |
| `app/packages/cli/src/commands/plugin.ts` | **New** - `init` and `validate` subcommands |
| `app/packages/cli/src/index.ts` | Register `plugin` command group |
| `website/content/docs/integrations/plugin-development.md` | **New** - developer guide |
| `website/content/docs/integrations/plugin-architecture.md` | Link to new doc + env var section |

---

## Verification

1. **Unit** - existing test suite runs unchanged (plugin-kit extraction is a transparent re-export).
2. **Scaffold** - `hissuno plugin init my-test-plugin`; verify generated package builds and typechecks.
3. **Load** - `npm link /tmp/my-test-plugin && HISSUNO_PLUGINS=@test/my-test-plugin npm run dev`. Server logs show `[external-loader] registered plugin my-test`.
4. **Catalog** - `curl localhost:3000/api/plugins/catalog` returns the external plugin alongside built-ins.
5. **Marketplace UI** - external plugin's card renders at `/projects/<id>/integrations` with its data-URI icon.
6. **Connect** - auto-generated config dialog accepts credentials; `POST /api/plugins/my-test/connect` creates a connection.
7. **Sync** - manual sync hits the external plugin's `sync` handler; SSE events stream back; rows appear in `integration_synced_items`.
8. **Cron** - bump the stream's `next_sync_at` into the past and hit `/api/cron/sync`; verify the external plugin's sync runs.
9. **Collision** - attempting to register an id that matches a first-party plugin fails with a clear error; the server still boots.
10. **Removal** - unsetting `HISSUNO_PLUGINS` and restarting removes the plugin from the catalog; existing connections remain as orphans (expected).
