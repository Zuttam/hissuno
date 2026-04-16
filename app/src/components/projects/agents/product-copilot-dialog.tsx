'use client'

import Link from 'next/link'
import { Dialog, Button, Heading } from '@/components/ui'
import type { IntegrationStatuses } from '@/hooks/use-integration-statuses'

interface ProductCopilotDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  integrationStatuses: IntegrationStatuses
}

function ChannelStatus({ connected }: { connected: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${connected ? 'bg-[color:var(--accent-success)]' : 'bg-[color:var(--text-tertiary)]'}`}
    />
  )
}

export function ProductCopilotDialog({ open, onClose, projectId, integrationStatuses }: ProductCopilotDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title="Product Co-pilot" size="lg">
      <div className="flex flex-col gap-6">
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
        <div className="flex items-center justify-end border-t border-[color:var(--border-subtle)] pt-4">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
