// @ts-nocheck -- TODO: type drift unrelated to Mastra v1, re-enable after fixture cleanup
/**
 * Unit Tests for Knowledge Source Types
 *
 * Tests the pure helper functions that generate human-readable labels and
 * display values for knowledge sources.
 */

import { describe, it, expect } from 'vitest'
import {
  getSourceTypeLabel,
  getSourceDisplayValue,
  toKnowledgeSourceWithMeta,
  type KnowledgeSourceRecord,
  type KnowledgeSourceType,
} from '@/lib/knowledge/types'

// ============================================================================
// Helpers
// ============================================================================

function makeSource(overrides: Partial<KnowledgeSourceRecord> = {}): KnowledgeSourceRecord {
  return {
    id: 'src-1',
    project_id: 'proj-1',
    type: 'raw_text',
    url: null,
    storage_path: null,
    content: null,
    status: 'pending',
    error_message: null,
    analyzed_at: null,
    created_at: null,
    updated_at: null,
    analysis_scope: null,
    enabled: true,
    parent_id: null,
    name: null,
    description: null,
    analyzed_content: null,
    notion_page_id: null,
    origin: null,
    custom_fields: null,
    sort_order: 0,
    ...overrides,
  }
}

// ============================================================================
// getSourceTypeLabel
// ============================================================================

describe('getSourceTypeLabel', () => {
  it('returns "Website" for website type', () => {
    expect(getSourceTypeLabel('website')).toBe('Website')
  })

  it('returns "Documentation Portal" for docs_portal type', () => {
    expect(getSourceTypeLabel('docs_portal')).toBe('Documentation Portal')
  })

  it('returns "Uploaded Document" for uploaded_doc type', () => {
    expect(getSourceTypeLabel('uploaded_doc')).toBe('Uploaded Document')
  })

  it('returns "Raw Text" for raw_text type', () => {
    expect(getSourceTypeLabel('raw_text')).toBe('Raw Text')
  })

  it('returns "Notion" for notion type', () => {
    expect(getSourceTypeLabel('notion')).toBe('Notion')
  })

  it('covers all KnowledgeSourceType values', () => {
    const allTypes: KnowledgeSourceType[] = [
      'website',
      'docs_portal',
      'uploaded_doc',
      'raw_text',
      'notion',
      'folder',
    ]
    for (const t of allTypes) {
      expect(getSourceTypeLabel(t)).toBeTruthy()
    }
  })
})

// ============================================================================
// getSourceDisplayValue
// ============================================================================

describe('getSourceDisplayValue', () => {
  describe('website type', () => {
    it('returns the URL when present', () => {
      const source = makeSource({ type: 'website', url: 'https://docs.example.com' })
      expect(getSourceDisplayValue(source)).toBe('https://docs.example.com')
    })

    it('returns "No URL" when url is null', () => {
      const source = makeSource({ type: 'website', url: null })
      expect(getSourceDisplayValue(source)).toBe('No URL')
    })
  })

  describe('docs_portal type', () => {
    it('returns the URL when present', () => {
      const source = makeSource({ type: 'docs_portal', url: 'https://docs.example.com/portal' })
      expect(getSourceDisplayValue(source)).toBe('https://docs.example.com/portal')
    })

    it('returns "No URL" when url is null', () => {
      const source = makeSource({ type: 'docs_portal', url: null })
      expect(getSourceDisplayValue(source)).toBe('No URL')
    })
  })

  describe('uploaded_doc type', () => {
    it('returns the filename from storage path', () => {
      const source = makeSource({
        type: 'uploaded_doc',
        storage_path: 'proj-1/docs/1234567890-readme.pdf',
      })
      expect(getSourceDisplayValue(source)).toBe('1234567890-readme.pdf')
    })

    it('returns "Unknown file" when storage_path is null', () => {
      const source = makeSource({ type: 'uploaded_doc', storage_path: null })
      expect(getSourceDisplayValue(source)).toBe('Unknown file')
    })
  })

  describe('raw_text type', () => {
    it('returns content preview truncated at 100 chars', () => {
      const longContent = 'A'.repeat(150)
      const source = makeSource({ type: 'raw_text', content: longContent })
      const result = getSourceDisplayValue(source)
      expect(result).toBe('A'.repeat(100) + '...')
    })

    it('returns full content when under 100 chars', () => {
      const source = makeSource({ type: 'raw_text', content: 'Short text content' })
      expect(getSourceDisplayValue(source)).toBe('Short text content')
    })

    it('returns "Empty" when content is null', () => {
      const source = makeSource({ type: 'raw_text', content: null })
      expect(getSourceDisplayValue(source)).toBe('Empty')
    })

    it('returns "Empty" when content is empty string', () => {
      const source = makeSource({ type: 'raw_text', content: '' })
      expect(getSourceDisplayValue(source)).toBe('Empty')
    })
  })

  describe('notion type', () => {
    it('returns the name when present', () => {
      const source = makeSource({ type: 'notion', name: 'Product Roadmap' })
      expect(getSourceDisplayValue(source)).toBe('Product Roadmap')
    })

    it('returns "Notion page" when name is null', () => {
      const source = makeSource({ type: 'notion', name: null })
      expect(getSourceDisplayValue(source)).toBe('Notion page')
    })
  })
})

// ============================================================================
// toKnowledgeSourceWithMeta
// ============================================================================

describe('toKnowledgeSourceWithMeta', () => {
  it('adds typeLabel and displayValue to source', () => {
    const source = makeSource({ type: 'website', url: 'https://docs.test.com' })
    const result = toKnowledgeSourceWithMeta(source)

    expect(result.typeLabel).toBe('Website')
    expect(result.displayValue).toBe('https://docs.test.com')
    expect(result.id).toBe(source.id)
    expect(result.project_id).toBe(source.project_id)
    expect(result.type).toBe('website')
  })

  it('works for every source type', () => {
    const types: KnowledgeSourceType[] = [
      'website',
      'docs_portal',
      'uploaded_doc',
      'raw_text',
      'notion',
      'folder',
    ]
    for (const t of types) {
      const source = makeSource({ type: t })
      const result = toKnowledgeSourceWithMeta(source)
      expect(result.typeLabel).toBeTruthy()
      expect(result.displayValue).toBeTruthy()
    }
  })
})