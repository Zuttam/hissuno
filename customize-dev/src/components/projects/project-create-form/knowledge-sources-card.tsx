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
}

export function KnowledgeSourcesCard({
  sources,
  onSourcesChange,
  skipAnalysis,
  onSkipAnalysisChange,
}: KnowledgeSourcesCardProps) {
  const [activeSection, setActiveSection] = useState<KnowledgeSourceType | null>(null)

  const addSource = (type: KnowledgeSourceType, data: Partial<KnowledgeSourceInput>) => {
    const newSource: KnowledgeSourceInput = {
      id: `${type}-${Date.now()}`,
      type,
      ...data,
    }
    onSourcesChange([...sources, newSource])
    setActiveSection(null)
  }

  const removeSource = (id: string) => {
    onSourcesChange(sources.filter((s) => s.id !== id))
  }

  const updateSource = (id: string, data: Partial<KnowledgeSourceInput>) => {
    onSourcesChange(sources.map((s) => (s.id === id ? { ...s, ...data } : s)))
  }

  return (
    <Card>
      <div className="p-6">
        <h2 className="font-mono text-xl font-bold uppercase tracking-tight text-[color:var(--foreground)] mb-2">
          Knowledge Sources
        </h2>
        <p className="text-sm text-[color:var(--text-secondary)] mb-6">
          Add materials to help the support agent understand your product. You can add these now or later.
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

        {/* Added Sources List */}
        {sources.length > 0 && (
          <div className="mb-6 space-y-2">
            <h3 className="font-mono text-sm font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
              Added Sources ({sources.length})
            </h3>
            <div className="space-y-2">
              {sources.map((source) => (
                <div
                  key={source.id}
                  className="flex items-center justify-between rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center rounded-[4px] bg-[color:var(--accent-primary)] px-2 py-1 font-mono text-xs font-semibold uppercase text-white">
                      {getSourceTypeLabel(source.type)}
                    </span>
                    <span className="text-sm text-[color:var(--foreground)] truncate max-w-[300px]">
                      {source.url || source.file?.name || source.content?.slice(0, 50) + '...' || 'Unknown'}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSource(source.id)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add Source Buttons */}
        <div className="space-y-4">
          <h3 className="font-mono text-sm font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
            Add a Source
          </h3>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SourceTypeButton
              type="website"
              active={activeSection === 'website'}
              onClick={() => setActiveSection(activeSection === 'website' ? null : 'website')}
            />
            <SourceTypeButton
              type="docs_portal"
              active={activeSection === 'docs_portal'}
              onClick={() => setActiveSection(activeSection === 'docs_portal' ? null : 'docs_portal')}
            />
            <SourceTypeButton
              type="uploaded_doc"
              active={activeSection === 'uploaded_doc'}
              onClick={() => setActiveSection(activeSection === 'uploaded_doc' ? null : 'uploaded_doc')}
            />
            <SourceTypeButton
              type="raw_text"
              active={activeSection === 'raw_text'}
              onClick={() => setActiveSection(activeSection === 'raw_text' ? null : 'raw_text')}
            />
          </div>

          {/* Active Section Forms */}
          {activeSection === 'website' && (
            <UrlInputSection
              type="website"
              placeholder="https://yourcompany.com"
              onSubmit={(url) => addSource('website', { url })}
              onCancel={() => setActiveSection(null)}
            />
          )}

          {activeSection === 'docs_portal' && (
            <UrlInputSection
              type="docs_portal"
              placeholder="https://docs.yourcompany.com"
              onSubmit={(url) => addSource('docs_portal', { url })}
              onCancel={() => setActiveSection(null)}
            />
          )}

          {activeSection === 'uploaded_doc' && (
            <FileUploadSection
              onSubmit={(file) => addSource('uploaded_doc', { file })}
              onCancel={() => setActiveSection(null)}
            />
          )}

          {activeSection === 'raw_text' && (
            <RawTextSection
              onSubmit={(content) => addSource('raw_text', { content })}
              onCancel={() => setActiveSection(null)}
            />
          )}
        </div>

        {/* Info Message */}
        <div className="mt-6">
          <Alert variant="info">
            <p className="text-sm">
              <strong>Note:</strong> The project&apos;s source code will automatically be analyzed when analysis runs.
              Add additional sources like your website, documentation, or custom notes to enhance the support agent&apos;s knowledge.
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

interface SourceTypeButtonProps {
  type: KnowledgeSourceType
  active: boolean
  onClick: () => void
}

function SourceTypeButton({ type, active, onClick }: SourceTypeButtonProps) {
  const icons: Record<KnowledgeSourceType, string> = {
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
            : 'border-[color:var(--border-subtle)] bg-[color:var(--surface)] hover:border-[color:var(--border)] hover:bg-[color:var(--surface-hover)]'
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
    <div className="rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-4">
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
        <Button type="button" onClick={handleSubmit}>
          Add
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
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
    <div className="rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-4">
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
        <Button type="button" onClick={handleSubmit} disabled={!file}>
          Add
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
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
    <div className="rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-4">
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
        <Button type="button" onClick={handleSubmit}>
          Add
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
