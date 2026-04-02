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
  | 'notion'

/** Origin of a document source (how the content was imported) */
export type KnowledgeSourceOrigin = 'upload' | 'notion' | 'google_drive'

/** Processing status for knowledge sources */
export type KnowledgeSourceStatus = 'pending' | 'analyzing' | 'done' | 'failed'

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
  analyzed_at: Date | null
  created_at: Date | null
  updated_at: Date | null
  /** Optional path prefix to scope codebase analysis (only for codebase type) */
  analysis_scope: string | null
  /** Whether this source is enabled for analysis */
  enabled: boolean
  /** FK to source_codes - required for type='codebase', null for other types */
  source_code_id: string | null
  /** User-defined display name for this source */
  name: string | null
  /** User-defined description for what this source contains */
  description: string | null
  /** Analyzed/sanitized markdown content */
  analyzed_content: string | null
  /** Notion page ID (only for notion type) */
  notion_page_id: string | null
  /** Origin of document content (upload, notion, google_drive) - only for uploaded_doc type */
  origin: KnowledgeSourceOrigin | null
  /** Custom field values */
  custom_fields: Record<string, unknown> | null
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
  analyzed_at?: Date | null
  created_at?: Date
  updated_at?: Date
  analysis_scope?: string | null
  enabled?: boolean
  /** FK to source_codes - required for type='codebase', null for other types */
  source_code_id?: string | null
  name?: string | null
  description?: string | null
  analyzed_content?: string | null
  notion_page_id?: string | null
  origin?: KnowledgeSourceOrigin | null
  custom_fields?: Record<string, unknown> | null
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
  analyzed_at?: Date | null
  created_at?: Date
  updated_at?: Date
  analysis_scope?: string | null
  enabled?: boolean
  /** FK to source_codes - required for type='codebase', null for other types */
  source_code_id?: string | null
  name?: string | null
  description?: string | null
  analyzed_content?: string | null
  notion_page_id?: string | null
  origin?: KnowledgeSourceOrigin | null
  custom_fields?: Record<string, unknown> | null
}

/**
 * Knowledge source with joined source_code data (for codebase type)
 */
export interface KnowledgeSourceWithCodebase extends KnowledgeSourceRecord {
  /** Product scope ID resolved via entity_relationships */
  product_scope_id?: string | null
  source_code: {
    id: string
    kind: string
    repository_url: string | null
    repository_branch: string | null
    commit_sha: string | null
    synced_at: Date | null
    created_at: Date | null
    updated_at: Date | null
  } | null
}

// ============================================================================
// KNOWLEDGE PACKAGES
// ============================================================================

/**
 * Database row type for knowledge_packages table
 */
export interface KnowledgePackageRecord {
  id: string
  project_id: string
  name: string
  description: string | null
  guidelines: string | null
  faq_content: string | null
  howto_content: string | null
  feature_docs_content: string | null
  troubleshooting_content: string | null
  compiled_at: Date | null
  source_snapshot: Record<string, unknown> | null
  created_at: Date | null
  updated_at: Date | null
}

/**
 * Insert type for knowledge_packages table
 */
export interface KnowledgePackageInsert {
  id?: string
  project_id: string
  name: string
  description?: string | null
  guidelines?: string | null
  faq_content?: string | null
  howto_content?: string | null
  feature_docs_content?: string | null
  troubleshooting_content?: string | null
  compiled_at?: Date | null
  source_snapshot?: Record<string, unknown> | null
  created_at?: Date
  updated_at?: Date
}

/**
 * Database row type for knowledge_package_sources junction table
 */
export interface KnowledgePackageSourceRecord {
  id: string
  package_id: string
  source_id: string
  created_at: Date | null
}

/**
 * Knowledge package with related data for display
 */
export interface KnowledgePackageWithSources extends KnowledgePackageRecord {
  /** Knowledge sources linked to this package */
  sources: KnowledgeSourceRecord[]
  /** Count of linked sources */
  sourceCount: number
  /** Most recent analysis timestamp */
  lastAnalyzedAt: string | null
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
 * Compilation workflow input
 */
export interface PackageCompilationInput {
  projectId: string
  /** Package ID to compile */
  packageId?: string
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
 * Get human-readable label for source type
 */
export function getSourceTypeLabel(type: KnowledgeSourceType): string {
  const labels: Record<KnowledgeSourceType, string> = {
    codebase: 'Codebase',
    website: 'Website',
    docs_portal: 'Documentation Portal',
    uploaded_doc: 'Uploaded Document',
    raw_text: 'Raw Text',
    notion: 'Notion',
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
    case 'notion':
      return source.name ?? 'Notion page'
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
