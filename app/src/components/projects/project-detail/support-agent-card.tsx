'use client'

import { useState } from 'react'
import type { ProjectWithCodebase } from '@/lib/projects/queries'
import { Badge } from '@/components/ui'

interface SupportAgentCardProps {
  project: ProjectWithCodebase & {
    public_key?: string | null
    secret_key?: string | null
    allowed_origins?: string[] | null
  }
  isLoading?: boolean
}

export function SupportAgentCard({ project, isLoading }: SupportAgentCardProps) {
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
      <div className="space-y-6 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="space-y-2">
            <div className="h-3 w-full rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-3 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        </div>
      </div>
    )
  }

  const publicKey = project.public_key ?? 'Not generated'
  const allowedOrigins = project.allowed_origins ?? []

  return (
    <div className="space-y-6 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
      {/* Widget Integration Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Support Agent
        </h3>
        
        {/* Allowed Origins */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Allowed Origins
          </h4>
          {allowedOrigins.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {allowedOrigins.map((origin, index) => (
                <span
                  key={index}
                  className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-mono text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  {origin}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No origins configured. Widget will work from any domain (development mode).
            </p>
          )}
        </div>
      </div>

      {/* Quick Start */}
      <div className="space-y-4">
        <h4 className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Widget Integration
        </h4>
        <div className="relative">
          <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-sm text-slate-100">
            <code>{generateSnippet(publicKey)}</code>
          </pre>
          <button
            type="button"
            onClick={() => copyToClipboard(generateSnippet(publicKey), 'snippet')}
            className="absolute right-2 top-2 rounded-md bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-600"
          >
            {copiedField === 'snippet' ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Slack Integration - Coming Soon */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h4 className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Slack Integration
          </h4>
          <Badge variant="default">Coming Soon</Badge>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Connect your Slack workspace to receive support requests and manage conversations directly from Slack.
        </p>
      </div>
    </div>
  )
}

function generateSnippet(publicKey: string): string {
  return `import { HissunoWidget } from '@hissuno/widget';

<HissunoWidget 
  publicKey="${publicKey}"
/>`
}
