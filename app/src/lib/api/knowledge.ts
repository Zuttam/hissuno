import { fetchApi, fetchApiRaw, buildUrl } from './fetch'
import type { KnowledgeSourceWithCodebase, SupportPackageWithSources } from '@/lib/knowledge/types'

const paths = {
  sources: '/api/knowledge/sources',
  source: (s: string) => `/api/knowledge/sources/${s}`,
  sourceReanalyze: (s: string) => `/api/knowledge/sources/${s}/reanalyze`,
  packageAnalyze: (pkg: string) => `/api/settings/agents/support-agent/packages/${pkg}/analyze`,
  packageAnalyzeCancel: (pkg: string) => `/api/settings/agents/support-agent/packages/${pkg}/analyze/cancel`,
  packageAnalyzeStream: (pkg: string) => `/api/settings/agents/support-agent/packages/${pkg}/analyze/stream`,
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

export async function getPackageAnalysisStatus(projectId: string, packageId: string) {
  return fetchApiRaw(buildUrl(paths.packageAnalyze(packageId), { projectId }))
}

export async function triggerPackageAnalysis(projectId: string, packageId: string) {
  return fetchApiRaw(buildUrl(paths.packageAnalyze(packageId), { projectId }), { method: 'POST' })
}

export async function cancelPackageAnalysis(projectId: string, packageId: string) {
  return fetchApi<Record<string, unknown>>(
    buildUrl(paths.packageAnalyzeCancel(packageId), { projectId }),
    { method: 'POST', errorMessage: 'Failed to cancel analysis' },
  )
}

export function packageAnalyzeStreamUrl(projectId: string, packageId: string): string {
  return buildUrl(paths.packageAnalyzeStream(packageId), { projectId })
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

