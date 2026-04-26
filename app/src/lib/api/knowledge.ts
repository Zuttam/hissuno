import { fetchApi, fetchApiRaw, buildUrl } from './fetch'
import type { KnowledgeSourceWithCodebase, SupportPackageWithSources } from '@/lib/knowledge/types'

const SUPPORT_WIKI_SKILL_ID = 'hissuno-support-wiki'

const paths = {
  sources: '/api/knowledge/sources',
  source: (s: string) => `/api/knowledge/sources/${s}`,
  sourceReanalyze: (s: string) => `/api/knowledge/sources/${s}/reanalyze`,
  // Automation runner — replaces the package-compilation workflow's
  // dedicated /api/settings/agents/support-agent/packages/<id>/analyze*
  // endpoints.
  automationRun: (skillId: string) => `/api/automations/${skillId}/run`,
  automationStream: (runId: string) => `/api/automations/runs/${runId}/stream`,
  automationCancel: (runId: string) => `/api/automations/runs/${runId}/cancel`,
}

// ---------------------------------------------------------------------------
// Knowledge Sources CRUD
// ---------------------------------------------------------------------------

export async function listKnowledgeSources(projectId: string) {
  return fetchApi<{ sources: KnowledgeSourceWithCodebase[] }>(buildUrl(paths.sources, { projectId }), {
    errorMessage: 'Failed to load knowledge sources',
  })
}

export async function getKnowledgeSource(projectId: string, sourceId: string) {
  return fetchApi<{ source: KnowledgeSourceWithCodebase }>(buildUrl(paths.source(sourceId), { projectId }), {
    errorMessage: 'Failed to load knowledge source',
  })
}

export async function addKnowledgeSource(
  projectId: string,
  data: FormData | Record<string, unknown>,
) {
  return fetchApi<{ source: KnowledgeSourceWithCodebase }>(buildUrl(paths.sources, { projectId }), {
    method: 'POST',
    ...(data instanceof FormData ? { formData: data } : { body: data }),
    errorMessage: 'Failed to add source',
  })
}

export async function updateKnowledgeSource(
  projectId: string,
  sourceId: string,
  updates: Record<string, unknown>,
) {
  return fetchApi<{ source: KnowledgeSourceWithCodebase }>(buildUrl(paths.source(sourceId), { projectId }), {
    method: 'PATCH',
    body: updates,
    errorMessage: 'Failed to update source',
  })
}

export async function deleteKnowledgeSource(
  projectId: string,
  sourceId: string,
  options?: { children?: 'reparent' | 'delete' },
) {
  const params: Record<string, string> = { projectId }
  if (options?.children) params.children = options.children
  return fetchApi<void>(buildUrl(paths.source(sourceId), params), {
    method: 'DELETE',
    errorMessage: 'Failed to delete source',
  })
}

// ---------------------------------------------------------------------------
// Package Analysis
// ---------------------------------------------------------------------------

/**
 * Status query (legacy: usePackageAnalysis(checkOnMount=true) used this to
 * reconnect to a running workflow). The automation runner has no per-entity
 * "is running" lookup yet, so this returns "not running" — reconnect on
 * mount becomes a no-op until we want it to query automation_runs.
 */
export async function getPackageAnalysisStatus(_projectId: string, _packageId: string) {
  return new Response(JSON.stringify({ isRunning: false }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  }) as Response & { ok: boolean }
}

/**
 * Trigger a support-wiki compile via the automation runner. The hook
 * extracts `runId` from the response body to open the SSE stream.
 */
export async function triggerPackageAnalysis(projectId: string, packageId: string) {
  return fetchApiRaw(buildUrl(paths.automationRun(SUPPORT_WIKI_SKILL_ID), { projectId }), {
    method: 'POST',
    body: { entity: { type: 'package', id: packageId } },
  })
}

export async function cancelPackageAnalysis(projectId: string, _packageId: string, runId?: string) {
  if (!runId) return { ok: false, error: 'Missing runId' } as const
  return fetchApi<Record<string, unknown>>(
    buildUrl(paths.automationCancel(runId), { projectId }),
    { method: 'POST', errorMessage: 'Failed to cancel analysis' },
  )
}

export function packageAnalyzeStreamUrl(projectId: string, runId: string): string {
  return buildUrl(paths.automationStream(runId), { projectId })
}

// ---------------------------------------------------------------------------
// Source Analysis (fire-and-forget; poll /api/knowledge/sources for status)
// ---------------------------------------------------------------------------

export async function reanalyzeKnowledgeSource(projectId: string, sourceId: string) {
  return fetchApi<{ sourceId: string; status: string }>(
    buildUrl(paths.sourceReanalyze(sourceId), { projectId }),
    { method: 'POST', errorMessage: 'Failed to start analysis' },
  )
}

// ---------------------------------------------------------------------------
// Knowledge Packages CRUD
// ---------------------------------------------------------------------------

const packagePaths = {
  list: '/api/settings/agents/support-agent/packages',
  detail: (pkg: string) => `/api/settings/agents/support-agent/packages/${pkg}`,
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
// Notion Bulk Import
// ---------------------------------------------------------------------------

export async function addNotionSources(
  projectId: string,
  pages: Array<{ pageId: string; title: string; url: string }>,
) {
  return fetchApi<{ sources: unknown[] }>(buildUrl(paths.sources, { projectId }), {
    method: 'POST',
    body: { type: 'notion_bulk', pages },
    errorMessage: 'Failed to import Notion pages',
  })
}

