'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Dialog, Button, Heading, Alert } from '@/components/ui'
import { updateIssueAnalysisSettings } from '@/lib/api/settings'
import type { IntegrationStatuses } from '@/hooks/use-integration-statuses'

interface ProductCopilotDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  integrationStatuses: IntegrationStatuses
  initialSettings: {
    memoryEnabled: boolean
  }
  onSaved: () => void
}

function ChannelStatus({ connected }: { connected: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${connected ? 'bg-[color:var(--accent-success)]' : 'bg-[color:var(--text-tertiary)]'}`}
    />
  )
}

export function ProductCopilotDialog({
  open,
  onClose,
  projectId,
  integrationStatuses,
  initialSettings,
  onSaved,
}: ProductCopilotDialogProps) {
  const [memoryEnabled, setMemoryEnabled] = useState(initialSettings.memoryEnabled)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setMemoryEnabled(initialSettings.memoryEnabled)
      setError(null)
    }
  }, [open, initialSettings])

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    try {
      await updateIssueAnalysisSettings(projectId, {
        product_agent_memory_enabled: memoryEnabled,
      })
      onSaved()
      onClose()
    } catch {
      setError('Failed to save settings. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Product Co-pilot" size="lg">
      <div className="flex flex-col gap-6">
        {error && <Alert variant="warning">{error}</Alert>}

        <p className="text-sm text-[color:var(--text-secondary)]">
          When used as a team agent (via the dashboard), Hissuno has broader access to your project data.
        </p>

        <div className="flex flex-col gap-4">
          <Heading as="h4" size="subsection">Capabilities</Heading>
          <ul className="flex flex-col gap-3 text-sm text-[color:var(--foreground)]">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 text-[color:var(--text-tertiary)]">&#8226;</span>
              <span>Full data access to issues, feedback, and contacts</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 text-[color:var(--text-tertiary)]">&#8226;</span>
              <span>Record feedback on behalf of customers</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 text-[color:var(--text-tertiary)]">&#8226;</span>
              <span>Search and analyze customer conversations</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 text-[color:var(--text-tertiary)]">&#8226;</span>
              <span>Available via CLI, Skills, or the dashboard chat</span>
            </li>
          </ul>
        </div>

        {/* Memory */}
        <div className="flex flex-col gap-3">
          <Heading as="h4" size="subsection">Memory</Heading>
          <div className="flex items-center justify-between rounded-lg border border-[color:var(--border-subtle)] px-4 py-3">
            <div>
              <span className="text-sm font-medium text-[color:var(--foreground)]">Enable memory</span>
              <p className="text-xs text-[color:var(--text-tertiary)] mt-0.5">
                Remember context across this team member's sessions so they can pick up where they left off.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={memoryEnabled}
              onClick={() => setMemoryEnabled((v) => !v)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:ring-offset-2 ${
                memoryEnabled ? 'bg-[color:var(--accent-primary)]' : 'bg-[color:var(--surface-hover)]'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  memoryEnabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Interactive Channels */}
        <div className="flex flex-col gap-3">
          <Heading as="h4" size="subsection">Interactive Channels</Heading>
          <div className="flex flex-col gap-2">
            <Link
              href={`/projects/${projectId}/integrations?dialog=widget`}
              className="flex items-center gap-3 rounded-[4px] border border-[color:var(--border-subtle)] p-3 hover:bg-[color:var(--surface-hover)] transition-colors"
              onClick={onClose}
            >
              <ChannelStatus connected={integrationStatuses.widget} />
              <svg className="h-5 w-5 text-[color:var(--foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <span className="text-sm font-medium text-[color:var(--foreground)]">Widget</span>
              <span className="ml-auto text-xs text-[color:var(--text-tertiary)]">
                {integrationStatuses.widget ? 'Connected' : 'Not connected'}
              </span>
            </Link>
            <Link
              href={`/projects/${projectId}/integrations?dialog=slack`}
              className="flex items-center gap-3 rounded-[4px] border border-[color:var(--border-subtle)] p-3 hover:bg-[color:var(--surface-hover)] transition-colors"
              onClick={onClose}
            >
              <ChannelStatus connected={integrationStatuses.slack} />
              <img src="/logos/slack.svg" alt="Slack" width={20} height={20} />
              <span className="text-sm font-medium text-[color:var(--foreground)]">Slack</span>
              <span className="ml-auto text-xs text-[color:var(--text-tertiary)]">
                {integrationStatuses.slack ? 'Connected' : 'Not connected'}
              </span>
            </Link>
          </div>
        </div>

        <div className="rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface-hover)] p-4">
          <p className="text-sm text-[color:var(--text-secondary)]">
            Create an API key in the{' '}
            <strong className="text-[color:var(--foreground)]">Access</strong>{' '}
            tab, then connect via{' '}
            <a href="/docs/connect/cli" className="text-[color:var(--accent-selected)] hover:underline">CLI</a> or{' '}
            <a href="/docs/connect/skills" className="text-[color:var(--accent-selected)] hover:underline">Skills</a>.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-[color:var(--border-subtle)] pt-4">
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} loading={isSaving} disabled={isSaving}>
            Save
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
