# Rename `knowledge_package` to `support_package`

## Context

The `knowledge_package` entity is a curated, compiled bundle of knowledge sources used exclusively by the support/widget agent. Its name creates confusion with `knowledge_sources` (the general graph-level resource). Renaming to `support_package` makes the distinction clear and aligns with the existing `support_agent_*` naming convention.

## Scope

- **22 files** to modify (18 with `knowledgePackage` camelCase + 4 additional with `KnowledgePackage` PascalCase types)
- **2 DB tables** to rename: `knowledge_packages` -> `support_packages`, `knowledge_package_sources` -> `support_package_sources`
- **URL paths unchanged** - routes stay at `/settings/agents/support-agent/packages/`
- **Column `support_agent_package_id` unchanged** - already correctly named

## Steps

### 1. DB Migration

Create `app/src/lib/db/migrations/0005_rename_knowledge_packages.sql`:

```sql
ALTER TABLE "knowledge_packages" RENAME TO "support_packages";
ALTER TABLE "knowledge_package_sources" RENAME TO "support_package_sources";
```

### 2. Drizzle Schema (`app/src/lib/db/schema/app.ts`)

- `knowledgePackages` -> `supportPackages`, pgTable name -> `'support_packages'` (line 435)
- `knowledgePackageSources` -> `supportPackageSources`, pgTable name -> `'support_package_sources'` (line 454)
- FK reference on line 458: `knowledgePackages.id` -> `supportPackages.id`

### 3. Relations (`app/src/lib/db/schema/relations.ts`)

- Update imports (lines 25-26)
- `knowledgePackages: many(...)` -> `supportPackages: many(...)` (line 87)
- `supportAgentPackage: one(knowledgePackages, ...)` -> `one(supportPackages, ...)` (line 106)
- `knowledgePackageSources` -> `supportPackageSources` in knowledgeSourcesRelations (line 228)
- Rename `knowledgePackagesRelations` -> `supportPackagesRelations` (lines 237-240)
- Rename `knowledgePackageSourcesRelations` -> `supportPackageSourcesRelations` (lines 242-245)

### 4. Query Types (`app/src/lib/db/queries/types.ts`)

- Update imports, rename:
  - `KnowledgePackageRow` -> `SupportPackageRow`
  - `KnowledgePackageInsert` -> `SupportPackageInsert`
  - `KnowledgePackageSourceRow` -> `SupportPackageSourceRow`
  - `KnowledgePackageSourceInsert` -> `SupportPackageSourceInsert`

### 5. Knowledge Types (`app/src/lib/knowledge/types.ts`)

- `KnowledgePackageRecord` -> `SupportPackageRecord` (line 134)
- `KnowledgePackageInsert` -> `SupportPackageInsert` (line 153)
- `KnowledgePackageSourceRecord` -> `SupportPackageSourceRecord` (line 172)
- `KnowledgePackageWithSources` -> `SupportPackageWithSources` (line 182)
- Update comments/section header (lines 127-132)

### 6. Agent Context Type (`app/src/types/agent.ts`)

- `knowledgePackageId` -> `supportPackageId`

### 7. Agent Router (`app/src/mastra/agents/router.ts`)

- `knowledgePackageId` -> `supportPackageId` in params and all usages

### 8. Knowledge Services

**`app/src/lib/knowledge/loader.ts`**:
- Update imports and all `knowledgePackages`/`knowledgePackageSources` table refs

**`app/src/lib/knowledge/compile-service.ts`**:
- Update imports and all table refs

### 9. Support Agent Query (`app/src/lib/db/queries/project-settings/support-agent.ts`)

- Import `supportPackages` instead of `knowledgePackages`
- Update `db.query.knowledgePackages` -> `db.query.supportPackages`

### 10. API Routes (5 files)

All under `app/src/app/api/(project)/settings/agents/support-agent/packages/`:
- `route.ts` - update table imports/refs, log strings
- `[packageId]/route.ts` - update table imports/refs, log strings
- `[packageId]/analyze/route.ts` - update table imports/refs
- `[packageId]/analyze/stream/route.ts` - update table imports/refs
- `[packageId]/analyze/cancel/route.ts` - update table imports/refs

### 11. Integration Handlers

**`app/src/lib/integrations/slack/message-processor.ts`**:
- `knowledgePackageId` -> `supportPackageId`

**`app/src/app/api/(project)/integrations/widget/chat/stream/route.ts`**:
- `knowledgePackageId` -> `supportPackageId`

### 12. MCP Tools (`app/src/mcp/tools.ts`)

- `knowledgePackageId` -> `supportPackageId` in runtime context

### 13. Frontend

**`app/src/lib/api/knowledge.ts`**:
- `KnowledgePackageWithSources` -> `SupportPackageWithSources`

**`app/src/app/(authenticated)/projects/[id]/configuration/page.tsx`**:
- Update type import and useState generic

**`app/src/components/projects/knowledge/package-list.tsx`**:
- Update type import and all `KnowledgePackageWithSources` usages (~9 occurrences)

**`app/src/components/projects/knowledge/package-list-item.tsx`**:
- Update type import and prop type

**`app/src/components/projects/knowledge/package-dialog.tsx`**:
- Update type imports

**`app/src/components/projects/agents/support-agent-dialog.tsx`**:
- Update type import and usage

### 14. Tests

**`app/src/__tests__/unit/mastra/agents/agent-config.test.ts`**:
- `knowledgePackageId` -> `supportPackageId` in all test params

**`app/src/__tests__/unit/mcp/tools.test.ts`**:
- `knowledgePackageId` -> `supportPackageId`

### 15. Apply to Dev DB

- Run `npx drizzle-kit push` to apply the rename to the local dev database

## Verification

1. `npx drizzle-kit push` succeeds without errors
2. TypeScript compiles: `npx tsc --noEmit` passes
3. Tests pass: `npm test`
4. Manual: open the configuration page, verify packages list/create/edit/delete still works
5. Manual: verify widget chat still loads package knowledge
