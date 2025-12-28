'use client'

import { useState } from 'react'
import type { ProjectWithCodebase } from '@/lib/projects/queries'
import { Badge, Collapsible } from '@/components/ui'

interface IntegrationsSectionProps {
  project: ProjectWithCodebase & {
    public_key?: string | null
    secret_key?: string | null
    allowed_origins?: string[] | null
  }
  isLoading?: boolean
}

export function IntegrationsSection({ project, isLoading }: IntegrationsSectionProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const copyToClipboard = async (value: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedField(fieldName)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 pt-4 border-t border-[color:var(--border-subtle)]">
        <div className="animate-pulse flex gap-6">
          <div className="h-4 w-32 rounded bg-[color:var(--surface-hover)]" />
          <div className="h-4 w-24 rounded bg-[color:var(--surface-hover)]" />
        </div>
      </div>
    )
  }

  const publicKey = project.public_key ?? 'Not generated'
  const isWidgetConfigured = Boolean(project.public_key)

  return (
    <div className="flex flex-col gap-4 pt-4 border-t border-[color:var(--border-subtle)]">
      {/* Widget Integration */}
      <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
        <div className="flex items-center gap-2">
          <StatusDot active={isWidgetConfigured} />
          <span className="text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
            Widget Integration
          </span>
        </div>

        <Collapsible
          trigger="View code"
          defaultOpen={false}
          headerActions={
            <button
              type="button"
              onClick={() => copyToClipboard(generateSnippet(publicKey), 'snippet')}
              className="rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-transparent px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-[color:var(--text-secondary)] transition hover:border-[color:var(--border)] hover:bg-[color:var(--surface-hover)]"
            >
              {copiedField === 'snippet' ? 'Copied!' : 'Copy'}
            </button>
          }
          className="flex-1"
        >
          <pre className="overflow-x-auto rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-3 text-xs font-mono text-[color:var(--foreground)]">
            <code>{generateSnippet(publicKey)}</code>
          </pre>
        </Collapsible>
      </div>

      {/* Slack Integration */}
      <div className="flex items-center gap-x-6">
        <div className="flex items-center gap-2">
          <StatusDot active={false} />
          <span className="text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
            Slack Integration
          </span>
        </div>
        <Badge variant="default">Coming Soon</Badge>
      </div>
    </div>
  )
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className={`h-2 w-2 rounded-full ${
        active ? 'bg-emerald-500' : 'bg-[color:var(--text-tertiary)]'
      }`}
    />
  )
}

function generateSnippet(publicKey: string): string {
  return `import { HissunoWidget } from '@hissuno/widget';

<HissunoWidget
  publicKey="${publicKey}"
/>`
}
