/**
 * Knowledge source and package types for the support agent knowledge system
 */

/** Types of knowledge sources that can be analyzed (user-addable sources only) */
export type KnowledgeSourceType =
  | 'website'
  | 'docs_portal'
  | 'uploaded_doc'
  | 'raw_text'

/** Processing status for knowledge sources */
export type KnowledgeSourceStatus = 'pending' | 'processing' | 'completed' | 'failed'

/** Categories for compiled knowledge packages */
export type KnowledgeCategory = 'business' | 'product' | 'technical'

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
  sourceCodePath?: string
  sources: Array<{
    id: string
    type: KnowledgeSourceType
    url?: string
    storagePath?: string
    content?: string
  }>
}

/**
 * Analysis workflow output
 */
export interface KnowledgeAnalysisOutput {
  business: string
  product: string
  technical: string
}

/**
 * Get human-readable label for source type
 */
export function getSourceTypeLabel(type: KnowledgeSourceType): string {
  const labels: Record<KnowledgeSourceType, string> = {
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
