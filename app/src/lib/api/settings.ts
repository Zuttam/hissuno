import { fetchApi, buildUrl } from './fetch'
import type { ProductScopeRecord } from '@/types/product-scope'
import type { GraphEvaluationConfig } from '@/mastra/workflows/graph-evaluation/config'

type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T

const paths = {
  productScopes: '/api/product-scopes',
}

// ---------------------------------------------------------------------------
// Product Scopes
// ---------------------------------------------------------------------------

export async function listProductScopes(projectId: string): Promise<ProductScopeRecord[]> {
  const url = buildUrl(paths.productScopes, { projectId })
  const { scopes } = await fetchApi<{ scopes: ProductScopeRecord[] }>(url, {
    errorMessage: 'Failed to load product scopes.',
  })
  return scopes ?? []
}

export async function getProductScope(projectId: string, scopeId: string): Promise<ProductScopeRecord> {
  const url = buildUrl(`${paths.productScopes}/${scopeId}`, { projectId })
  const { scope } = await fetchApi<{ scope: ProductScopeRecord }>(url, {
    errorMessage: 'Failed to load product scope.',
  })
  return scope
}

export interface CreateProductScopeParams {
  name: string
  slug?: string
  description?: string
  color?: string
  type?: 'product_area' | 'initiative' | 'experiment'
  goals?: Array<{ id: string; text: string }> | null
  parent_id?: string | null
  custom_fields?: Record<string, unknown>
}

export async function createProductScope(
  projectId: string,
  input: CreateProductScopeParams,
): Promise<ProductScopeRecord> {
  const url = buildUrl(paths.productScopes, { projectId })
  const { scope } = await fetchApi<{ scope: ProductScopeRecord }>(url, {
    method: 'POST',
    body: input,
    errorMessage: 'Failed to create product scope.',
  })
  return scope
}

export interface UpdateProductScopeParams {
  name?: string
  slug?: string
  description?: string
  color?: string
  type?: 'product_area' | 'initiative' | 'experiment'
  goals?: Array<{ id: string; text: string }> | null
  parent_id?: string | null
  custom_fields?: Record<string, unknown>
}

export async function updateProductScope(
  projectId: string,
  scopeId: string,
  input: UpdateProductScopeParams,
): Promise<ProductScopeRecord> {
  const url = buildUrl(`${paths.productScopes}/${scopeId}`, { projectId })
  const { scope } = await fetchApi<{ scope: ProductScopeRecord }>(url, {
    method: 'PATCH',
    body: input,
    errorMessage: 'Failed to update product scope.',
  })
  return scope
}

export async function deleteProductScope(
  projectId: string,
  scopeId: string,
  childrenMode: 'reparent' | 'delete' = 'reparent',
): Promise<void> {
  const params: Record<string, string> = { projectId }
  if (childrenMode === 'delete') params.children = 'delete'
  const url = buildUrl(`${paths.productScopes}/${scopeId}`, params)
  await fetchApi<{ success: boolean }>(url, {
    method: 'DELETE',
    errorMessage: 'Failed to delete product scope.',
  })
}

export async function saveProductScopes(projectId: string, scopes: unknown[]) {
  const url = buildUrl(paths.productScopes, { projectId })
  return fetchApi<Record<string, unknown>>(url, {
    method: 'PATCH',
    body: { scopes },
    errorMessage: 'Failed to save product scopes.',
  })
}

// ---------------------------------------------------------------------------
// Settings accessor factory
// ---------------------------------------------------------------------------

function createSettingsAccessor(pathKey: string, label: string) {
  const apiPath = pathKey ? `/api/settings/${pathKey}` : '/api/settings'
  return {
    get: async (projectId: string) => {
      const url = buildUrl(apiPath, { projectId })
      return fetchApi<{ settings: Record<string, unknown> }>(url, {
        errorMessage: `Failed to load ${label} settings.`,
      })
    },
    update: async (projectId: string, body: Record<string, unknown>) => {
      const url = buildUrl(apiPath, { projectId })
      return fetchApi<Record<string, unknown>>(url, {
        method: 'PATCH',
        body,
        errorMessage: `Failed to save ${label} settings.`,
      })
    },
  }
}

// ---------------------------------------------------------------------------
// Project Settings (general)
// ---------------------------------------------------------------------------

const projectSettings = createSettingsAccessor('', 'project')
export const getProjectSettings = projectSettings.get
export const updateProjectSettings = projectSettings.update

// ---------------------------------------------------------------------------
// Agent & Workflow Settings (factory-generated)
// ---------------------------------------------------------------------------

const supportAgent = createSettingsAccessor('agents/support-agent', 'support agent')
export const getSupportAgentSettings = supportAgent.get
export const updateSupportAgentSettings = supportAgent.update

const issueAnalysis = createSettingsAccessor('agents/issue-analysis', 'issue analysis')
export const getIssueAnalysisSettings = issueAnalysis.get
export const updateIssueAnalysisSettings = issueAnalysis.update

const knowledgeAnalysis = createSettingsAccessor('agents/knowledge-analysis', 'knowledge analysis')
export const getKnowledgeAnalysisSettings = knowledgeAnalysis.get
export const updateKnowledgeAnalysisSettings = knowledgeAnalysis.update

export async function getGraphEvaluationSettingsClient(projectId: string): Promise<{ config: GraphEvaluationConfig }> {
  const url = buildUrl('/api/settings/graph-evaluation', { projectId })
  return fetchApi<{ config: GraphEvaluationConfig }>(url, {
    errorMessage: 'Failed to load graph evaluation settings.',
  })
}

export async function updateGraphEvaluationSettingsClient(
  projectId: string,
  patch: DeepPartial<GraphEvaluationConfig>,
): Promise<{ config: GraphEvaluationConfig }> {
  const url = buildUrl('/api/settings/graph-evaluation', { projectId })
  return fetchApi<{ config: GraphEvaluationConfig }>(url, {
    method: 'PATCH',
    body: patch as Record<string, unknown>,
    errorMessage: 'Failed to save graph evaluation settings.',
  })
}

const aiModel = createSettingsAccessor('ai-model', 'AI model')
export const getAIModelSettingsClient = aiModel.get
export const updateAIModelSettingsClient = aiModel.update

