/**
 * Knowledge source and package types for the support agent knowledge system
 */

/** Types of knowledge sources that can be analyzed */
export type KnowledgeSourceType =
  | 'codebase'
  | 'website'
  | 'docs_portal'
  | 'uploaded_doc'
  | 'raw_text'

/** Processing status for knowledge sources */
export type KnowledgeSourceStatus = 'pending' | 'processing' | 'completed' | 'failed'

/** Categories for compiled knowledge packages */
export type KnowledgeCategory = 'business' | 'product' | 'technical' | 'faq' | 'how_to'

/**
 * Database row type for knowledge_sources table
 */
export interface KnowledgeSourceRecord {
  id: string
  project_id: string
  type: KnowledgeSourceType
  url: string | null
  storage_path: string | null
  content: string | null
  status: KnowledgeSourceStatus
  error_message: string | null
  analyzed_at: string | null
  created_at: string
  updated_at: string
  /** Optional path prefix to scope codebase analysis (only for codebase type) */
  analysis_scope: string | null
  /** Whether this source is enabled for analysis */
  enabled: boolean
  /** FK to source_codes - required for type='codebase', null for other types */
  source_code_id: string | null
}

/**
 * Insert type for knowledge_sources table
 */
export interface KnowledgeSourceInsert {
  id?: string
  project_id: string
  type: KnowledgeSourceType
  url?: string | null
  storage_path?: string | null
  content?: string | null
  status?: KnowledgeSourceStatus
  error_message?: string | null
  analyzed_at?: string | null
  created_at?: string
  updated_at?: string
  analysis_scope?: string | null
  enabled?: boolean
  /** FK to source_codes - required for type='codebase', null for other types */
  source_code_id?: string | null
}

/**
 * Update type for knowledge_sources table
 */
export interface KnowledgeSourceUpdate {
  id?: string
  project_id?: string
  type?: KnowledgeSourceType
  url?: string | null
  storage_path?: string | null
  content?: string | null
  status?: KnowledgeSourceStatus
  error_message?: string | null
  analyzed_at?: string | null
  created_at?: string
  updated_at?: string
  analysis_scope?: string | null
  enabled?: boolean
  /** FK to source_codes - required for type='codebase', null for other types */
  source_code_id?: string | null
}

/**
 * Knowledge source with joined source_code data (for codebase type)
 */
export interface KnowledgeSourceWithCodebase extends KnowledgeSourceRecord {
  source_code: {
    id: string
    kind: string
    repository_url: string | null
    repository_branch: string | null
    commit_sha: string | null
    synced_at: string | null
    created_at: string
    updated_at: string
  } | null
}

/**
 * Database row type for knowledge_packages table
 */
export interface KnowledgePackageRecord {
  id: string
  project_id: string
  category: KnowledgeCategory
  storage_path: string
  version: number
  generated_at: string
  created_at: string
  updated_at: string
  /** FK to named_knowledge_packages - links this category to a named package */
  named_package_id: string | null
}

// ============================================================================
// NAMED KNOWLEDGE PACKAGES
// ============================================================================

/**
 * Database row type for named_knowledge_packages table
 */
export interface NamedKnowledgePackageRecord {
  id: string
  project_id: string
  name: string
  description: string | null
  guidelines: string | null
  created_at: string
  updated_at: string
}

/**
 * Insert type for named_knowledge_packages table
 */
export interface NamedKnowledgePackageInsert {
  id?: string
  project_id: string
  name: string
  description?: string | null
  guidelines?: string | null
  created_at?: string
  updated_at?: string
}

/**
 * Update type for named_knowledge_packages table
 */
export interface NamedKnowledgePackageUpdate {
  id?: string
  project_id?: string
  name?: string
  description?: string | null
  guidelines?: string | null
  created_at?: string
  updated_at?: string
}

/**
 * Database row type for named_package_sources junction table
 */
export interface NamedPackageSourceRecord {
  id: string
  package_id: string
  source_id: string
  created_at: string
}

/**
 * Named package with related data for display
 */
export interface NamedPackageWithSources extends NamedKnowledgePackageRecord {
  /** Knowledge sources linked to this package */
  sources: KnowledgeSourceRecord[]
  /** Generated category packages (business, product, technical, faq, how_to) */
  categories: KnowledgePackageRecord[]
  /** Count of linked sources */
  sourceCount: number
  /** Most recent analysis timestamp */
  lastAnalyzedAt: string | null
}

/**
 * Insert type for knowledge_packages table
 */
export interface KnowledgePackageInsert {
  id?: string
  project_id: string
  category: KnowledgeCategory
  storage_path: string
  version?: number
  generated_at?: string
  created_at?: string
  updated_at?: string
  /** FK to named_knowledge_packages */
  named_package_id?: string | null
}

/**
 * Update type for knowledge_packages table
 */
export interface KnowledgePackageUpdate {
  id?: string
  project_id?: string
  category?: KnowledgeCategory
  storage_path?: string
  version?: number
  generated_at?: string
  created_at?: string
  updated_at?: string
  /** FK to named_knowledge_packages */
  named_package_id?: string | null
}

/**
 * Input for creating a new knowledge source via API
 */
export interface CreateKnowledgeSourceInput {
  type: KnowledgeSourceType
  url?: string
  content?: string
  // For uploaded_doc, file is handled separately via FormData
}

/**
 * Knowledge source with display-friendly properties
 */
export interface KnowledgeSourceWithMeta extends KnowledgeSourceRecord {
  /** Human-readable label for the source type */
  typeLabel: string
  /** Display value (URL, filename, or content preview) */
  displayValue: string
}

/**
 * Combined knowledge package content for display
 */
export interface KnowledgePackageContent {
  category: KnowledgeCategory
  content: string
  version: number
  generatedAt: string
}

/**
 * Analysis workflow input
 */
export interface KnowledgeAnalysisInput {
  projectId: string
  /** Named package ID to associate generated knowledge with */
  namedPackageId?: string
  /** @deprecated Use codebase source in sources array instead */
  sourceCodePath?: string
  sources: Array<{
    id: string
    type: KnowledgeSourceType
    url?: string
    storagePath?: string
    content?: string
    analysisScope?: string
    enabled?: boolean
  }>
}

/**
 * Analysis workflow output
 */
export interface KnowledgeAnalysisOutput {
  business: string
  product: string
  technical: string
  faq: string
  how_to: string
}

/**
 * Get human-readable label for source type
 */
export function getSourceTypeLabel(type: KnowledgeSourceType): string {
  const labels: Record<KnowledgeSourceType, string> = {
    codebase: 'Codebase',
    website: 'Website',
    docs_portal: 'Documentation Portal',
    uploaded_doc: 'Uploaded Document',
    raw_text: 'Raw Text',
  }
  return labels[type]
}

/**
 * Get display value for a knowledge source
 */
export function getSourceDisplayValue(source: KnowledgeSourceRecord): string {
  switch (source.type) {
    case 'codebase':
      return source.analysis_scope
        ? `Project source code (scope: ${source.analysis_scope})`
        : 'Project source code'
    case 'website':
    case 'docs_portal':
      return source.url ?? 'No URL'
    case 'uploaded_doc':
      return source.storage_path?.split('/').pop() ?? 'Unknown file'
    case 'raw_text':
      return source.content
        ? source.content.slice(0, 100) + (source.content.length > 100 ? '...' : '')
        : 'Empty'
    default:
      return 'Unknown source'
  }
}

/**
 * Convert a record to display-friendly format
 */
export function toKnowledgeSourceWithMeta(source: KnowledgeSourceRecord): KnowledgeSourceWithMeta {
  return {
    ...source,
    typeLabel: getSourceTypeLabel(source.type),
    displayValue: getSourceDisplayValue(source),
  }
}
