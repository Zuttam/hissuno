'use client'

import { Button, Spinner } from '@/components/ui'
import type { KnowledgeSourceRecord } from '@/lib/knowledge/types'

interface KnowledgeSourcesListProps {
  sources: KnowledgeSourceRecord[]
  isLoading: boolean
  onConfigure: () => void
}

const SOURCE_TYPE_CONFIG: Record<string, { icon: string; label: string }> = {
  codebase: { icon: '💻', label: 'Code' },
  website: { icon: '🌐', label: 'Web' },
  docs_portal: { icon: '📚', label: 'Docs' },
  uploaded_doc: { icon: '📄', label: 'Doc' },
  raw_text: { icon: '📝', label: 'Text' },
}

function getSourceLabel(
  source: KnowledgeSourceRecord & {
    source_code?: { repository_url?: string | null; repository_branch?: string | null } | null
  }
) {
  if (source.type === 'codebase') {
    // Try to extract repo name from repository_url if available
    if (source.source_code?.repository_url) {
      try {
        const url = new URL(source.source_code.repository_url)
        const repoName = url.pathname.replace(/^\//, '').replace(/\.git$/, '')
        const branch = source.source_code.repository_branch ?? 'main'
        return `${repoName} (${branch})`
      } catch {
        // Fall through to default
      }
    }
    return source.analysis_scope ?? 'Repository'
  }
  if (source.url) {
    try {
      const url = new URL(source.url)
      return url.hostname
    } catch {
      return source.url
    }
  }
  if (source.type === 'raw_text') {
    return 'Text content'
  }
  return source.storage_path?.split('/').pop() ?? 'Document'
}

export function KnowledgeSourcesList({ sources, isLoading, onConfigure }: KnowledgeSourcesListProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Spinner size="sm" />
      </div>
    )
  }

  if (sources.length === 0) {
    return (
      <div className="flex flex-col items-center text-center py-4">
        <div className="w-12 h-12 rounded-full bg-[color:var(--background-secondary)] flex items-center justify-center mb-4">
          <span className="text-2xl">🔗</span>
        </div>
        <p className="text-sm font-medium text-[color:var(--foreground)] mb-1">
          No resources connected
        </p>
        <p className="text-sm text-[color:var(--text-secondary)] mb-4">
          Connect your codebase, documentation, or other knowledge sources to power your agents.
        </p>
        <Button variant="primary" size="md" onClick={onConfigure}>
          Configure Resources
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {sources.map((source) => {
        const config = SOURCE_TYPE_CONFIG[source.type] ?? { icon: '📦', label: source.type }
        return (
          <div
            key={source.id}
            className="grid grid-cols-[auto_1fr] sm:grid-cols-[4.5rem_1fr] items-center gap-2 py-1"
          >
            <div className="flex items-center gap-1.5" title={config.label}>
              <span className="text-base">{config.icon}</span>
              <span className="text-xs font-medium text-[color:var(--text-secondary)] hidden sm:inline">
                {config.label}
              </span>
            </div>
            <span className="text-sm text-[color:var(--foreground)] truncate">
              {getSourceLabel(source)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
