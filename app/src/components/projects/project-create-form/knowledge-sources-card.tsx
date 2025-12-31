'use client'

import { useState, type ChangeEvent } from 'react'
import { Card, FormField, Input, Button, Textarea, Alert } from '@/components/ui'
import { getSourceTypeLabel, type KnowledgeSourceType } from '@/lib/knowledge/types'

export interface KnowledgeSourceInput {
  id: string
  type: KnowledgeSourceType
  url?: string
  content?: string
  file?: File
}

export interface KnowledgeSourcesCardProps {
  sources: KnowledgeSourceInput[]
  onSourcesChange: (sources: KnowledgeSourceInput[]) => void
  skipAnalysis: boolean
  onSkipAnalysisChange: (skip: boolean) => void
  // Codebase props
  hasCodebase: boolean
  codebaseType?: 'github' | 'upload-folder' | null
  includeCodebaseInAnalysis: boolean
  onIncludeCodebaseChange: (include: boolean) => void
  analysisScope: string
  onAnalysisScopeChange: (scope: string) => void
}

export function KnowledgeSourcesCard({
  sources,
  onSourcesChange,
  skipAnalysis,
  onSkipAnalysisChange,
  hasCodebase,
  codebaseType,
  includeCodebaseInAnalysis,
  onIncludeCodebaseChange,
  analysisScope,
  onAnalysisScopeChange,
}: KnowledgeSourcesCardProps) {
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null)
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false)
  const [activeAddType, setActiveAddType] = useState<KnowledgeSourceType | null>(null)

  const addSource = (type: KnowledgeSourceType, data: Partial<KnowledgeSourceInput>) => {
    const newSource: KnowledgeSourceInput = {
      id: `${type}-${Date.now()}`,
      type,
      ...data,
    }
    onSourcesChange([...sources, newSource])
    setActiveAddType(null)
    setIsAddSourceOpen(false)
  }

  const removeSource = (id: string) => {
    onSourcesChange(sources.filter((s) => s.id !== id))
    if (expandedSourceId === id) {
      setExpandedSourceId(null)
    }
  }

  const updateSource = (id: string, data: Partial<KnowledgeSourceInput>) => {
    onSourcesChange(sources.map((s) => (s.id === id ? { ...s, ...data } : s)))
  }

  const handleSourceClick = (id: string) => {
    setIsAddSourceOpen(false)
    setActiveAddType(null)
    setExpandedSourceId(expandedSourceId === id ? null : id)
  }

  const handleAddSourceClick = () => {
    setExpandedSourceId(null)
    setIsAddSourceOpen(!isAddSourceOpen)
    if (isAddSourceOpen) {
      setActiveAddType(null)
    }
  }

  const codebaseStatusLabel = codebaseType === 'github' 
    ? 'Connected via GitHub' 
    : codebaseType === 'upload-folder' 
      ? 'Uploaded folder' 
      : 'Not configured'

  // Calculate total count (codebase if included + other sources)
  const totalSourceCount = (hasCodebase && includeCodebaseInAnalysis ? 1 : 0) + sources.length

  return (
    <Card>
      <div className="p-6">
        <h2 className="font-mono text-xl font-bold uppercase tracking-tight text-[color:var(--foreground)] mb-2">
          Knowledge Sources
        </h2>
        <p className="text-sm text-[color:var(--text-secondary)] mb-6">
          Configure which sources to include in knowledge analysis for the support agent.
        </p>

        {/* Skip Analysis Toggle */}
        <div className="mb-6 flex items-center gap-3">
          <input
            type="checkbox"
            id="skip-analysis"
            checked={skipAnalysis}
            onChange={(e) => onSkipAnalysisChange(e.target.checked)}
            className="h-4 w-4 rounded border-2 border-[color:var(--border)] bg-[color:var(--background)]"
          />
          <label htmlFor="skip-analysis" className="text-sm text-[color:var(--text-secondary)]">
            Skip analysis for now (can be triggered later)
          </label>
        </div>

        {/* Added Sources Section */}
        <div className="space-y-3">
          {/* Header with Add Source link */}
          <div className="flex items-center justify-between">
            <h3 className="font-mono text-sm font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
              Added Sources {totalSourceCount > 0 && `(${totalSourceCount})`}
            </h3>
            <button
              type="button"
              onClick={handleAddSourceClick}
              className="font-mono text-xs font-semibold uppercase tracking-wide text-[color:var(--accent-primary)] hover:text-[color:var(--accent-primary-hover)] transition-colors"
            >
              + Add a Source
            </button>
          </div>
          {/* Add Source Collapsible Section */}
          {isAddSourceOpen && (
            <div className="mt-4 rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <SourceTypeButton
                  type="website"
                  active={activeAddType === 'website'}
                  onClick={() => setActiveAddType(activeAddType === 'website' ? null : 'website')}
                />
                <SourceTypeButton
                  type="docs_portal"
                  active={activeAddType === 'docs_portal'}
                  onClick={() => setActiveAddType(activeAddType === 'docs_portal' ? null : 'docs_portal')}
                />
                <SourceTypeButton
                  type="uploaded_doc"
                  active={activeAddType === 'uploaded_doc'}
                  onClick={() => setActiveAddType(activeAddType === 'uploaded_doc' ? null : 'uploaded_doc')}
                />
                <SourceTypeButton
                  type="raw_text"
                  active={activeAddType === 'raw_text'}
                  onClick={() => setActiveAddType(activeAddType === 'raw_text' ? null : 'raw_text')}
                />
              </div>

              {/* Active Add Section Forms */}
              {activeAddType === 'website' && (
                <div className="mt-4">
                  <UrlInputSection
                    type="website"
                    placeholder="https://yourcompany.com"
                    onSubmit={(url) => addSource('website', { url })}
                    onCancel={() => setActiveAddType(null)}
                  />
                </div>
              )}

              {activeAddType === 'docs_portal' && (
                <div className="mt-4">
                  <UrlInputSection
                    type="docs_portal"
                    placeholder="https://docs.yourcompany.com"
                    onSubmit={(url) => addSource('docs_portal', { url })}
                    onCancel={() => setActiveAddType(null)}
                  />
                </div>
              )}

              {activeAddType === 'uploaded_doc' && (
                <div className="mt-4">
                  <FileUploadSection
                    onSubmit={(file) => addSource('uploaded_doc', { file })}
                    onCancel={() => setActiveAddType(null)}
                  />
                </div>
              )}

              {activeAddType === 'raw_text' && (
                <div className="mt-4">
                  <RawTextSection
                    onSubmit={(content) => addSource('raw_text', { content })}
                    onCancel={() => setActiveAddType(null)}
                  />
                </div>
              )}
            </div>
          )}

          {/* Sources List */}
          <div className="space-y-2">
            {/* Codebase Source Row */}
            {hasCodebase && (
              <CodebaseSourceRow
                codebaseStatusLabel={codebaseStatusLabel}
                includeCodebaseInAnalysis={includeCodebaseInAnalysis}
                onIncludeCodebaseChange={onIncludeCodebaseChange}
                analysisScope={analysisScope}
                onAnalysisScopeChange={onAnalysisScopeChange}
                isExpanded={expandedSourceId === 'codebase'}
                onToggleExpand={() => handleSourceClick('codebase')}
              />
            )}

            {/* Other Sources */}
            {sources.map((source) => (
              <EditableSourceRow
                key={source.id}
                source={source}
                isExpanded={expandedSourceId === source.id}
                onToggleExpand={() => handleSourceClick(source.id)}
                onUpdate={(data) => updateSource(source.id, data)}
                onRemove={() => removeSource(source.id)}
              />
            ))}

            {/* Empty State */}
            {!hasCodebase && sources.length === 0 && (
              <div className="rounded-[4px] border-2 border-dashed border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-6 text-center">
                <p className="text-sm text-[color:var(--text-tertiary)]">
                  No sources added yet. Click &quot;Add a Source&quot; to get started.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Info Message */}
        <div className="mt-6">
          <Alert variant="info">
            <p className="text-sm">
              <strong>Tip:</strong> Add sources like your website, documentation, or custom notes to enhance the support agent&apos;s knowledge.
              Click on any source to edit its settings.
            </p>
          </Alert>
        </div>
      </div>
    </Card>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

interface CodebaseSourceRowProps {
  codebaseStatusLabel: string
  includeCodebaseInAnalysis: boolean
  onIncludeCodebaseChange: (include: boolean) => void
  analysisScope: string
  onAnalysisScopeChange: (scope: string) => void
  isExpanded: boolean
  onToggleExpand: () => void
}

function CodebaseSourceRow({
  codebaseStatusLabel,
  includeCodebaseInAnalysis,
  onIncludeCodebaseChange,
  analysisScope,
  onAnalysisScopeChange,
  isExpanded,
  onToggleExpand,
}: CodebaseSourceRowProps) {
  const [localScope, setLocalScope] = useState(analysisScope)

  const handleSave = () => {
    onAnalysisScopeChange(localScope)
    onToggleExpand()
  }

  const handleCancel = () => {
    setLocalScope(analysisScope)
    onToggleExpand()
  }

  return (
    <div className="rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] overflow-hidden">
      {/* Collapsed Row */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[color:var(--surface-hover)] transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center rounded-[4px] bg-[color:var(--accent-primary)] px-2 py-1 font-mono text-xs font-semibold uppercase text-white">
            Codebase
          </span>
          <span className="text-sm text-[color:var(--foreground)]">
            {codebaseStatusLabel}
          </span>
          <span className="text-xs text-[color:var(--text-tertiary)]">
            {isExpanded ? '▼' : '▶'}
          </span>
        </div>
        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={includeCodebaseInAnalysis}
              onChange={(e) => onIncludeCodebaseChange(e.target.checked)}
              className="peer sr-only"
            />
            <div className={`
              h-6 w-11 rounded-full border-2 transition-colors
              ${includeCodebaseInAnalysis 
                ? 'border-[color:var(--accent-selected)] bg-[color:var(--accent-selected)]' 
                : 'border-[color:var(--border)] bg-[color:var(--surface)]'
              }
              after:content-[''] after:absolute after:left-[4px] after:top-[4px] after:h-4 after:w-4 after:rounded-full after:transition-transform
              ${includeCodebaseInAnalysis ? 'after:translate-x-5 after:bg-white' : 'after:bg-[color:var(--text-tertiary)]'}
            `} />
          </label>
          <span className={`text-xs font-mono uppercase ${includeCodebaseInAnalysis ? 'text-[color:var(--accent-selected)]' : 'text-[color:var(--text-tertiary)]'}`}>
            {includeCodebaseInAnalysis ? 'Included' : 'Excluded'}
          </span>
        </div>
      </div>

      {/* Expanded Section */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-[color:var(--border-subtle)]">
          <FormField
            label="Analysis Scope"
            description="Limit analysis to a specific path (e.g., packages/my-app for monorepos)"
          >
            <input
              type="text"
              value={localScope}
              onChange={(e) => setLocalScope(e.target.value)}
              placeholder="Leave empty to analyze entire codebase"
              className="w-full rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--background)] px-3 py-2 font-mono text-sm text-[color:var(--foreground)] outline-none transition focus:border-[color:var(--accent-primary)] focus:ring-0"
            />
          </FormField>
          <div className="mt-4 flex gap-2">
            <Button type="button" size="sm" onClick={handleSave}>
              Save
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

interface EditableSourceRowProps {
  source: KnowledgeSourceInput
  isExpanded: boolean
  onToggleExpand: () => void
  onUpdate: (data: Partial<KnowledgeSourceInput>) => void
  onRemove: () => void
}

function EditableSourceRow({
  source,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onRemove,
}: EditableSourceRowProps) {
  const getDisplayValue = () => {
    if (source.url) return source.url
    if (source.file) return source.file.name
    if (source.content) return source.content.slice(0, 50) + (source.content.length > 50 ? '...' : '')
    return 'Unknown'
  }

  return (
    <div className="rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] overflow-hidden">
      {/* Collapsed Row */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[color:var(--surface-hover)] transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center rounded-[4px] bg-[color:var(--accent-primary)] px-2 py-1 font-mono text-xs font-semibold uppercase text-white">
            {getSourceTypeLabel(source.type)}
          </span>
          <span className="text-sm text-[color:var(--foreground)] truncate max-w-[300px]">
            {getDisplayValue()}
          </span>
          <span className="text-xs text-[color:var(--text-tertiary)]">
            {isExpanded ? '▼' : '▶'}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
        >
          Remove
        </Button>
      </div>

      {/* Expanded Edit Section */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-[color:var(--border-subtle)]">
          {(source.type === 'website' || source.type === 'docs_portal') && (
            <EditUrlSection
              type={source.type}
              initialUrl={source.url || ''}
              onSave={(url) => {
                onUpdate({ url })
                onToggleExpand()
              }}
              onCancel={onToggleExpand}
            />
          )}
          {source.type === 'uploaded_doc' && (
            <EditFileSection
              currentFile={source.file}
              onSave={(file) => {
                onUpdate({ file })
                onToggleExpand()
              }}
              onCancel={onToggleExpand}
            />
          )}
          {source.type === 'raw_text' && (
            <EditRawTextSection
              initialContent={source.content || ''}
              onSave={(content) => {
                onUpdate({ content })
                onToggleExpand()
              }}
              onCancel={onToggleExpand}
            />
          )}
        </div>
      )}
    </div>
  )
}

interface SourceTypeButtonProps {
  type: KnowledgeSourceType
  active: boolean
  onClick: () => void
}

function SourceTypeButton({ type, active, onClick }: SourceTypeButtonProps) {
  const icons: Record<KnowledgeSourceType, string> = {
    codebase: '💻',
    website: '🌐',
    docs_portal: '📚',
    uploaded_doc: '📄',
    raw_text: '📝',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex flex-col items-center gap-2 rounded-[4px] border-2 p-4 transition
        ${
          active
            ? 'border-[color:var(--accent-selected)] bg-[color:var(--accent-selected)]/10'
            : 'border-[color:var(--border-subtle)] bg-[color:var(--background)] hover:border-[color:var(--border)] hover:bg-[color:var(--surface-hover)]'
        }
      `}
    >
      <span className="text-2xl">{icons[type]}</span>
      <span className="font-mono text-xs font-semibold uppercase tracking-wide text-[color:var(--foreground)]">
        {getSourceTypeLabel(type)}
      </span>
    </button>
  )
}

// ============================================================================
// Add Source Form Sections
// ============================================================================

interface UrlInputSectionProps {
  type: 'website' | 'docs_portal'
  placeholder: string
  onSubmit: (url: string) => void
  onCancel: () => void
}

function UrlInputSection({ type, placeholder, onSubmit, onCancel }: UrlInputSectionProps) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = () => {
    if (!url.trim()) {
      setError('URL is required')
      return
    }

    try {
      new URL(url)
    } catch {
      setError('Please enter a valid URL')
      return
    }

    onSubmit(url.trim())
  }

  return (
    <div className="rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--background)] p-4">
      <FormField
        label={type === 'website' ? 'Website URL' : 'Documentation Portal URL'}
        htmlFor="source-url"
        supportingText={error ? <span className="text-red-500">{error}</span> : undefined}
      >
        <Input
          id="source-url"
          type="url"
          value={url}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setUrl(e.target.value)
            setError(null)
          }}
          placeholder={placeholder}
        />
      </FormField>
      <div className="mt-4 flex gap-2">
        <Button type="button" size="sm" onClick={handleSubmit}>
          Add
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

interface FileUploadSectionProps {
  onSubmit: (file: File) => void
  onCancel: () => void
}

function FileUploadSection({ onSubmit, onCancel }: FileUploadSectionProps) {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      // Check file type
      const allowedTypes = [
        'application/pdf',
        'text/plain',
        'text/markdown',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ]
      if (!allowedTypes.includes(selectedFile.type) && !selectedFile.name.endsWith('.md')) {
        setError('Please upload a PDF, TXT, MD, or Word document')
        return
      }
      // Check file size (max 50MB)
      if (selectedFile.size > 50 * 1024 * 1024) {
        setError('File size must be under 50MB')
        return
      }
      setFile(selectedFile)
      setError(null)
    }
  }

  const handleSubmit = () => {
    if (!file) {
      setError('Please select a file')
      return
    }
    onSubmit(file)
  }

  return (
    <div className="rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--background)] p-4">
      <FormField label="Upload Document" htmlFor="source-file" supportingText={error ? <span className="text-red-500">{error}</span> : undefined}>
        <input
          id="source-file"
          type="file"
          accept=".pdf,.txt,.md,.doc,.docx"
          onChange={handleFileChange}
          className="block w-full text-sm text-[color:var(--foreground)]
            file:mr-4 file:py-2 file:px-4
            file:rounded-[4px] file:border-2 file:border-[color:var(--border)]
            file:bg-[color:var(--surface)] file:text-[color:var(--foreground)]
            file:font-mono file:text-sm file:font-semibold file:uppercase
            hover:file:bg-[color:var(--surface-hover)]"
        />
      </FormField>
      {file && (
        <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
          Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <Button type="button" size="sm" onClick={handleSubmit} disabled={!file}>
          Add
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

interface RawTextSectionProps {
  onSubmit: (content: string) => void
  onCancel: () => void
}

function RawTextSection({ onSubmit, onCancel }: RawTextSectionProps) {
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = () => {
    if (!content.trim()) {
      setError('Please enter some content')
      return
    }
    onSubmit(content.trim())
  }

  return (
    <div className="rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--background)] p-4">
      <FormField
        label="Custom Knowledge (Q&A, Notes, etc.)"
        htmlFor="source-content"
        supportingText={error ? <span className="text-red-500">{error}</span> : undefined}
      >
        <Textarea
          id="source-content"
          value={content}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
            setContent(e.target.value)
            setError(null)
          }}
          placeholder={`Add custom Q&A pairs, product notes, or any other information...

Example:
Q: What is the refund policy?
A: We offer a 30-day money-back guarantee on all plans.

Q: How do I reset my password?
A: Go to Settings > Security > Reset Password.`}
          rows={8}
        />
      </FormField>
      <div className="mt-4 flex gap-2">
        <Button type="button" size="sm" onClick={handleSubmit}>
          Add
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

// ============================================================================
// Edit Source Form Sections
// ============================================================================

interface EditUrlSectionProps {
  type: 'website' | 'docs_portal'
  initialUrl: string
  onSave: (url: string) => void
  onCancel: () => void
}

function EditUrlSection({ type, initialUrl, onSave, onCancel }: EditUrlSectionProps) {
  const [url, setUrl] = useState(initialUrl)
  const [error, setError] = useState<string | null>(null)

  const handleSave = () => {
    if (!url.trim()) {
      setError('URL is required')
      return
    }

    try {
      new URL(url)
    } catch {
      setError('Please enter a valid URL')
      return
    }

    onSave(url.trim())
  }

  return (
    <>
      <FormField
        label={type === 'website' ? 'Website URL' : 'Documentation Portal URL'}
        htmlFor="edit-url"
        supportingText={error ? <span className="text-red-500">{error}</span> : undefined}
      >
        <Input
          id="edit-url"
          type="url"
          value={url}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setUrl(e.target.value)
            setError(null)
          }}
          placeholder={type === 'website' ? 'https://yourcompany.com' : 'https://docs.yourcompany.com'}
        />
      </FormField>
      <div className="mt-4 flex gap-2">
        <Button type="button" size="sm" onClick={handleSave}>
          Save
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </>
  )
}

interface EditFileSectionProps {
  currentFile?: File
  onSave: (file: File) => void
  onCancel: () => void
}

function EditFileSection({ currentFile, onSave, onCancel }: EditFileSectionProps) {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      const allowedTypes = [
        'application/pdf',
        'text/plain',
        'text/markdown',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ]
      if (!allowedTypes.includes(selectedFile.type) && !selectedFile.name.endsWith('.md')) {
        setError('Please upload a PDF, TXT, MD, or Word document')
        return
      }
      if (selectedFile.size > 50 * 1024 * 1024) {
        setError('File size must be under 50MB')
        return
      }
      setFile(selectedFile)
      setError(null)
    }
  }

  const handleSave = () => {
    if (!file) {
      setError('Please select a new file')
      return
    }
    onSave(file)
  }

  return (
    <>
      <FormField label="Replace Document" htmlFor="edit-file" supportingText={error ? <span className="text-red-500">{error}</span> : undefined}>
        {currentFile && (
          <p className="mb-2 text-sm text-[color:var(--text-secondary)]">
            Current: {currentFile.name} ({(currentFile.size / 1024).toFixed(1)} KB)
          </p>
        )}
        <input
          id="edit-file"
          type="file"
          accept=".pdf,.txt,.md,.doc,.docx"
          onChange={handleFileChange}
          className="block w-full text-sm text-[color:var(--foreground)]
            file:mr-4 file:py-2 file:px-4
            file:rounded-[4px] file:border-2 file:border-[color:var(--border)]
            file:bg-[color:var(--surface)] file:text-[color:var(--foreground)]
            file:font-mono file:text-sm file:font-semibold file:uppercase
            hover:file:bg-[color:var(--surface-hover)]"
        />
      </FormField>
      {file && (
        <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
          New: {file.name} ({(file.size / 1024).toFixed(1)} KB)
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <Button type="button" size="sm" onClick={handleSave} disabled={!file}>
          Save
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </>
  )
}

interface EditRawTextSectionProps {
  initialContent: string
  onSave: (content: string) => void
  onCancel: () => void
}

function EditRawTextSection({ initialContent, onSave, onCancel }: EditRawTextSectionProps) {
  const [content, setContent] = useState(initialContent)
  const [error, setError] = useState<string | null>(null)

  const handleSave = () => {
    if (!content.trim()) {
      setError('Please enter some content')
      return
    }
    onSave(content.trim())
  }

  return (
    <>
      <FormField
        label="Custom Knowledge (Q&A, Notes, etc.)"
        htmlFor="edit-content"
        supportingText={error ? <span className="text-red-500">{error}</span> : undefined}
      >
        <Textarea
          id="edit-content"
          value={content}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
            setContent(e.target.value)
            setError(null)
          }}
          placeholder="Add custom Q&A pairs, product notes, or any other information..."
          rows={8}
        />
      </FormField>
      <div className="mt-4 flex gap-2">
        <Button type="button" size="sm" onClick={handleSave}>
          Save
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </>
  )
}
