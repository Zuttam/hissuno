import { fetchApi, buildUrl } from './fetch'
import type { CustomTagRecord } from '@/types/session'
import type { ProductScopeRecord } from '@/types/product-scope'
import type { IssueSettings } from '@/lib/db/queries/project-settings/types'

const paths = {
  customTags: '/api/settings/custom-tags',
  feedbackIssues: '/api/settings/feedback-issues',
  productScopes: '/api/product-scopes',
}

// ---------------------------------------------------------------------------
// Custom Tags
// ---------------------------------------------------------------------------

export async function listCustomTags(projectId: string): Promise<CustomTagRecord[]> {
  const url = buildUrl(paths.customTags, { projectId })
  const { tags } = await fetchApi<{ tags: CustomTagRecord[] }>(url, {
    errorMessage: 'Failed to load custom tags.',
  })
  return tags ?? []
}

// ---------------------------------------------------------------------------
// Unified Feedback & Issues Settings
// ---------------------------------------------------------------------------

export interface FeedbackIssuesSettings {
  customTags: CustomTagRecord[]
  issueSettings: IssueSettings
}

export async function getFeedbackIssuesSettings(projectId: string): Promise<FeedbackIssuesSettings> {
  const url = buildUrl(paths.feedbackIssues, { projectId })
  return fetchApi<FeedbackIssuesSettings>(url, {
    errorMessage: 'Failed to load feedback & issues settings.',
  })
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
  type?: 'product_area' | 'initiative'
  goals?: Array<{ id: string; text: string }> | null
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
  type?: 'product_area' | 'initiative'
  goals?: Array<{ id: string; text: string }> | null
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

export async function deleteProductScope(projectId: string, scopeId: string): Promise<void> {
  const url = buildUrl(`${paths.productScopes}/${scopeId}`, { projectId })
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

const feedbackReview = createSettingsAccessor('agents/feedback-review', 'feedback review')
export const getFeedbackReviewSettings = feedbackReview.get
export const updateFeedbackReviewSettings = feedbackReview.update

const issueAnalysis = createSettingsAccessor('agents/issue-analysis', 'issue analysis')
export const getIssueAnalysisSettings = issueAnalysis.get
export const updateIssueAnalysisSettings = issueAnalysis.update

const knowledgeAnalysis = createSettingsAccessor('agents/knowledge-analysis', 'knowledge analysis')
export const getKnowledgeAnalysisSettings = knowledgeAnalysis.get
export const updateKnowledgeAnalysisSettings = knowledgeAnalysis.update

// ---------------------------------------------------------------------------
// Feedback & Issues Settings (unified write)
// ---------------------------------------------------------------------------

export async function updateFeedbackIssuesSettings(
  projectId: string,
  body: { custom_tags?: unknown[]; issue_tracking_enabled?: boolean },
) {
  const url = buildUrl(paths.feedbackIssues, { projectId })
  return fetchApi<Record<string, unknown>>(url, {
    method: 'PATCH',
    body,
    errorMessage: 'Failed to save feedback & issues settings.',
  })
}
