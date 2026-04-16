'use client'

import { useState, useEffect } from 'react'
import { ExternalLink } from 'lucide-react'
import { InlineAlert, Spinner } from '@/components/ui'

interface GitHubCodebaseSyncTabProps {
  projectId: string
}

interface CodebaseInfo {
  exists: boolean
  repoName?: string
  branch?: string
}

export function GitHubCodebaseSyncTab({ projectId }: GitHubCodebaseSyncTabProps) {
  const [info, setInfo] = useState<CodebaseInfo>({ exists: false })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/knowledge-sources?projectId=${projectId}&type=codebase`)
        if (response.ok) {
          const data = await response.json()
          const sources = data.sources ?? data ?? []
          const codebase = Array.isArray(sources) ? sources[0] : null
          if (codebase) {
            setInfo({
              exists: true,
              repoName: codebase.name || codebase.sourceCode?.repoFullName,
              branch: codebase.sourceCode?.branch,
            })
          }
        }
      } catch {
        // Ignore - will show "not configured"
      } finally {
        setIsLoading(false)
      }
    }

    void load()
  }, [projectId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size="md" />
      </div>
    )
  }

  if (!info.exists) {
    return (
      <div className="flex flex-col gap-3">
        <InlineAlert variant="info">
          No codebase knowledge source configured. Import a repository from the Knowledge Sources page.
        </InlineAlert>
        <a
          href={`/projects/${projectId}/knowledge`}
          className="inline-flex items-center gap-1 text-sm text-[color:var(--accent-selected)] hover:underline"
        >
          Go to Knowledge Sources
          <ExternalLink size={12} />
        </a>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-3 flex flex-col gap-1">
        <p className="text-sm text-[color:var(--text-secondary)]">
          <span className="text-[color:var(--text-tertiary)]">Repository:</span>{' '}
          <span className="font-medium">{info.repoName || 'Unknown'}</span>
        </p>
        {info.branch && (
          <p className="text-sm text-[color:var(--text-secondary)]">
            <span className="text-[color:var(--text-tertiary)]">Branch:</span>{' '}
            <span className="font-medium">{info.branch}</span>
          </p>
        )}
      </div>
      <a
        href={`/projects/${projectId}/knowledge`}
        className="inline-flex items-center gap-1 text-sm text-[color:var(--accent-selected)] hover:underline"
      >
        Manage in Knowledge Sources
        <ExternalLink size={12} />
      </a>
    </div>
  )
}
