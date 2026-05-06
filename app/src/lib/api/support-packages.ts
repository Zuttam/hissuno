/**
 * Support Package API helpers
 *
 * Support packages bundle knowledge sources (across one or more product scopes)
 * into a compiled context blob that the support agent uses at runtime. The
 * compilation pipeline still lives at /api/settings/agents/support-agent/packages.
 *
 * This file is the only client-side helper that needs to enumerate knowledge
 * across the whole project: the package dialog renders a picker with every
 * source the user could include in a package. Knowledge itself is scope-
 * namespaced in the API (`/api/product-scopes/[scopeId]/knowledge`), so we
 * aggregate client-side by walking scopes.
 */

import { fetchApi, fetchApiRaw, buildUrl } from './fetch'
import { listProductScopes } from './settings'
import type { KnowledgeSourceRecord, SupportPackageWithSources } from '@/lib/knowledge/types'

// ---------------------------------------------------------------------------
// Knowledge listing for the package picker
// ---------------------------------------------------------------------------

/**
 * Aggregate every knowledge entry across every scope in the project.
 * Used by the package dialog to populate its source-selection list.
 *
 * Returns sources annotated with their owning `product_scope_id` so the
 * dialog can group by scope.
 */
export async function listProjectKnowledgeForPackages(
  projectId: string,
): Promise<{ sources: Array<KnowledgeSourceRecord & { product_scope_id?: string | null }> }> {
  const scopes = await listProductScopes(projectId)
  if (scopes.length === 0) return { sources: [] }

  const responses = await Promise.all(
    scopes.map((scope) =>
      fetchApi<{ sources: Array<KnowledgeSourceRecord & { product_scope_id?: string | null }> }>(
        buildUrl(`/api/product-scopes/${scope.id}/knowledge`, { projectId }),
        { errorMessage: `Failed to load knowledge for scope ${scope.name}` },
      ).catch(() => ({ sources: [] })),
    ),
  )

  const all = responses.flatMap((r) => r.sources ?? [])
  return { sources: all }
}

// ---------------------------------------------------------------------------
// Support Packages CRUD
// ---------------------------------------------------------------------------

const packagePaths = {
  list: '/api/settings/agents/support-agent/packages',
  detail: (pkg: string) => `/api/settings/agents/support-agent/packages/${pkg}`,
  analyze: (pkg: string) => `/api/settings/agents/support-agent/packages/${pkg}/analyze`,
  analyzeCancel: (pkg: string) => `/api/settings/agents/support-agent/packages/${pkg}/analyze/cancel`,
  analyzeStream: (pkg: string) => `/api/settings/agents/support-agent/packages/${pkg}/analyze/stream`,
}

export async function listPackages(projectId: string) {
  return fetchApi<{ packages: SupportPackageWithSources[] }>(buildUrl(packagePaths.list, { projectId }), {
    errorMessage: 'Failed to load packages',
  })
}

export async function createPackage(
  projectId: string,
  body: Record<string, unknown>,
) {
  return fetchApi<Record<string, unknown>>(buildUrl(packagePaths.list, { projectId }), {
    method: 'POST',
    body,
    errorMessage: 'Failed to create package',
  })
}

export async function updatePackage(
  projectId: string,
  packageId: string,
  body: Record<string, unknown>,
) {
  return fetchApi<Record<string, unknown>>(buildUrl(packagePaths.detail(packageId), { projectId }), {
    method: 'PATCH',
    body,
    errorMessage: 'Failed to save package',
  })
}

export async function deletePackage(projectId: string, packageId: string) {
  return fetchApi<void>(buildUrl(packagePaths.detail(packageId), { projectId }), {
    method: 'DELETE',
    errorMessage: 'Failed to delete package',
  })
}

// ---------------------------------------------------------------------------
// Package Analysis (compilation)
// ---------------------------------------------------------------------------

export async function getPackageAnalysisStatus(projectId: string, packageId: string) {
  return fetchApiRaw(buildUrl(packagePaths.analyze(packageId), { projectId }))
}

export async function triggerPackageAnalysis(projectId: string, packageId: string) {
  return fetchApiRaw(buildUrl(packagePaths.analyze(packageId), { projectId }), { method: 'POST' })
}

export async function cancelPackageAnalysis(
  projectId: string,
  packageId: string,
  runId?: string,
) {
  const params: Record<string, string> = { projectId }
  if (runId) params.runId = runId
  return fetchApi<Record<string, unknown>>(
    buildUrl(packagePaths.analyzeCancel(packageId), params),
    { method: 'POST', errorMessage: 'Failed to cancel analysis' },
  )
}

export function packageAnalyzeStreamUrl(projectId: string, packageId: string): string {
  return buildUrl(packagePaths.analyzeStream(packageId), { projectId })
}
