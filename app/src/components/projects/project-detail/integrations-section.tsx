'use client'

import { useState } from 'react'
import type { ProjectWithCodebase } from '@/lib/projects/queries'
import type { IntegrationStats } from '@/lib/supabase/sessions'
import { Badge, Collapsible } from '@/components/ui'

type IntegrationStatus = 'inactive' | 'idle' | 'active'

interface IntegrationsSectionProps {
  project: ProjectWithCodebase & {
    public_key?: string | null
    secret_key?: string | null
    allowed_origins?: string[] | null
  }
  integrationStats: IntegrationStats | null
  isLoading?: boolean
}

function getIntegrationStatus(
  hasPublicKey: boolean,
  hasRecentActivity: boolean
): IntegrationStatus {
  if (!hasPublicKey) return 'inactive'
  if (!hasRecentActivity) return 'idle'
  return 'active'
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export function IntegrationsSection({ project, integrationStats, isLoading }: IntegrationsSectionProps) {
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
  const hasRecentActivity = integrationStats?.isActive ?? false
  const widgetStatus = getIntegrationStatus(isWidgetConfigured, hasRecentActivity)

  // Dynamic trigger text based on status
  const triggerText = isWidgetConfigured ? 'View code' : 'How to integrate'

  return (
    <div className="flex flex-col gap-4 pt-4 border-t border-[color:var(--border-subtle)]">
      {/* Widget Integration */}
      <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
        <div className="flex items-center gap-2">
          <StatusIndicator status={widgetStatus} />
          <span className="text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
            Widget Integration
          </span>
          {/* Last activity - only show if configured and has activity */}
          {isWidgetConfigured && integrationStats?.lastActivityAt && (
            <span className="text-xs text-[color:var(--text-tertiary)]">
              · Last: {formatRelativeTime(integrationStats.lastActivityAt)}
            </span>
          )}
        </div>

        <Collapsible
          trigger={triggerText}
          defaultOpen={!isWidgetConfigured}
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
          <StatusIndicator status="inactive" />
          <span className="text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
            Slack Integration
          </span>
        </div>
        <Badge variant="default">Coming Soon</Badge>
      </div>
    </div>
  )
}

function StatusIndicator({ status }: { status: IntegrationStatus }) {
  const colorClass = {
    inactive: 'bg-[color:var(--text-tertiary)]', // Gray
    idle: 'bg-amber-500',                         // Yellow
    active: 'bg-emerald-500',                     // Green
  }[status]

  return <span className={`h-2 w-2 rounded-full ${colorClass}`} />
}

function generateSnippet(publicKey: string): string {
  return `import { HissunoWidget } from '@hissuno/widget';

<HissunoWidget
  publicKey="${publicKey}"
/>`
}
