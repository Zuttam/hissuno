'use client'

import { useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui'
import type { IssueWithSessions } from '@/types/issue'
import { AddFeedbackDialog } from './add-feedback-dialog'

const SOURCE_BADGE_VARIANTS: Record<string, 'info' | 'success' | 'warning' | 'default'> = {
  widget: 'info',
  slack: 'warning',
  intercom: 'success',
  gong: 'default',
  api: 'default',
  manual: 'default',
}

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60))
      return diffMinutes <= 1 ? 'just now' : `${diffMinutes}m ago`
    }
    return `${diffHours}h ago`
  }
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return `${Math.floor(diffDays / 30)}mo ago`
}

function formatARR(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value}`
}

type SessionItem = IssueWithSessions['sessions'][number]

interface LinkedFeedbackTreeProps {
  sessions: IssueWithSessions['sessions']
  projectId: string
  onLinkSession?: (sessionId: string) => Promise<boolean>
  onUnlinkSession?: (sessionId: string) => Promise<boolean>
}

export function LinkedFeedbackTree({ sessions, projectId, onLinkSession, onUnlinkSession }: LinkedFeedbackTreeProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false)

  const tree = useMemo(() => {
    const companyGroups = new Map<string, {
      id: string
      name: string
      arr: number | null
      contacts: Map<string, { id: string; name: string; sessions: SessionItem[] }>
    }>()
    const externalContacts = new Map<string, { id: string; name: string; sessions: SessionItem[] }>()
    const anonymous: SessionItem[] = []

    for (const session of sessions) {
      if (!session.contact) {
        anonymous.push(session)
        continue
      }

      if (session.contact.company) {
        const companyId = session.contact.company.id
        if (!companyGroups.has(companyId)) {
          companyGroups.set(companyId, {
            id: session.contact.company.id,
            name: session.contact.company.name,
            arr: session.contact.company.arr,
            contacts: new Map(),
          })
        }
        const company = companyGroups.get(companyId)!
        if (!company.contacts.has(session.contact.id)) {
          company.contacts.set(session.contact.id, {
            id: session.contact.id,
            name: session.contact.name,
            sessions: [],
          })
        }
        company.contacts.get(session.contact.id)!.sessions.push(session)
      } else {
        if (!externalContacts.has(session.contact.id)) {
          externalContacts.set(session.contact.id, {
            id: session.contact.id,
            name: session.contact.name,
            sessions: [],
          })
        }
        externalContacts.get(session.contact.id)!.sessions.push(session)
      }
    }

    const contactIds = new Set<string>()
    for (const session of sessions) {
      if (session.contact) contactIds.add(session.contact.id)
    }
    const totalARR = Array.from(companyGroups.values()).reduce((sum, c) => sum + (c.arr ?? 0), 0)

    return {
      companies: Array.from(companyGroups.values()),
      externalContacts: Array.from(externalContacts.values()),
      anonymous,
      contactCount: contactIds.size,
      companyCount: companyGroups.size,
      totalARR,
    }
  }, [sessions])

  const handleAddSessions = useCallback(async (sessionIds: string[]) => {
    if (!onLinkSession) return
    for (const sessionId of sessionIds) {
      await onLinkSession(sessionId)
    }
  }, [onLinkSession])

  const summaryParts: string[] = []
  if (tree.contactCount > 0) {
    summaryParts.push(`${tree.contactCount} contact${tree.contactCount !== 1 ? 's' : ''}`)
  }
  if (tree.companyCount > 0) {
    summaryParts.push(`${tree.companyCount} compan${tree.companyCount !== 1 ? 'ies' : 'y'}`)
  }
  if (tree.totalARR > 0) {
    summaryParts.push(`${formatARR(tree.totalARR)} ARR`)
  }

  const renderSession = (session: SessionItem) => {
    const sourceVariant = SOURCE_BADGE_VARIANTS[session.source] || 'default'
    const sourceLabel = session.source.charAt(0).toUpperCase() + session.source.slice(1)
    return (
      <div
        key={session.id}
        className="group/session flex items-center gap-2 rounded-[4px] px-1 py-0.5 text-sm transition hover:bg-[color:var(--surface-hover)]"
      >
        <Link
          href={`/projects/${projectId}/sessions?session=${session.id}`}
          className="flex min-w-0 flex-1 items-center gap-2"
        >
          <Badge variant={sourceVariant}>
            {sourceLabel}
          </Badge>
          <span className="min-w-0 flex-1 truncate text-[color:var(--foreground)] hover:underline">
            {session.name || 'Unnamed Feedback'}
          </span>
          <span className="shrink-0 text-xs text-[color:var(--text-tertiary)]">
            {formatRelativeDate(session.created_at)}
          </span>
        </Link>
        {onUnlinkSession && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              void onUnlinkSession(session.id)
            }}
            className="shrink-0 rounded-[4px] p-0.5 text-[color:var(--text-tertiary)] opacity-0 transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--accent-danger)] group-hover/session:opacity-100"
            aria-label={`Remove ${session.name || 'feedback'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
    )
  }

  const linkedSessionIds = sessions.map((s) => s.id)

  const headerRow = (
    <div className="flex items-center gap-1">
      <span className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
        Linked Feedback ({sessions.length})
        {summaryParts.length > 0 && (
          <span className="ml-1 text-[10px] normal-case tracking-normal text-[color:var(--text-tertiary)]">
            ({summaryParts.join(' / ')})
          </span>
        )}
      </span>
      {onLinkSession && (
        <button
          type="button"
          onClick={() => setAddDialogOpen(true)}
          className="ml-auto rounded-[4px] p-1 text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]"
          aria-label="Add linked feedback"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      )}
    </div>
  )

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col gap-1">
        {headerRow}
        <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
          No linked feedback
        </p>
        {onLinkSession && (
          <AddFeedbackDialog
            open={addDialogOpen}
            onClose={() => setAddDialogOpen(false)}
            projectId={projectId}
            excludeSessionIds={linkedSessionIds}
            onAddSessions={handleAddSessions}
          />
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      {headerRow}

      <div className="flex flex-col gap-3 mt-1">
        {/* Company groups */}
        {tree.companies.map((company) => (
          <div key={company.id} className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 px-1 text-sm">
              <Link
                href={`/projects/${projectId}/customers/companies/${company.id}`}
                className="font-medium text-[color:var(--foreground)] hover:underline"
              >
                {company.name}
              </Link>
              {company.arr != null && company.arr > 0 && (
                <span className="text-xs text-[color:var(--text-tertiary)]">
                  {formatARR(company.arr)}
                </span>
              )}
            </div>
            {Array.from(company.contacts.values()).map((contact) => (
              <div key={contact.id} className="flex flex-col gap-1 pl-3">
                <Link
                  href={`/projects/${projectId}/customers/contacts/${contact.id}`}
                  className="px-1 text-sm text-[color:var(--text-secondary)] hover:underline"
                >
                  {contact.name}
                </Link>
                <div className="flex flex-col gap-1 pl-3">
                  {contact.sessions.map(renderSession)}
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* External contacts (no company) */}
        {tree.externalContacts.length > 0 && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 px-1 text-sm">
              <span className="font-medium text-[color:var(--text-tertiary)]">External</span>
            </div>
            {tree.externalContacts.map((contact) => (
              <div key={contact.id} className="flex flex-col gap-1 pl-3">
                <Link
                  href={`/projects/${projectId}/customers/contacts/${contact.id}`}
                  className="px-1 text-sm text-[color:var(--text-secondary)] hover:underline"
                >
                  {contact.name}
                </Link>
                <div className="flex flex-col gap-1 pl-3">
                  {contact.sessions.map(renderSession)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Anonymous sessions */}
        {tree.anonymous.length > 0 && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 px-1 text-sm">
              <span className="font-medium text-[color:var(--text-tertiary)]">Anonymous</span>
            </div>
            <div className="flex flex-col gap-0.5 pl-3">
              {tree.anonymous.map(renderSession)}
            </div>
          </div>
        )}
      </div>

      {onLinkSession && (
        <AddFeedbackDialog
          open={addDialogOpen}
          onClose={() => setAddDialogOpen(false)}
          projectId={projectId}
          excludeSessionIds={linkedSessionIds}
          onAddSessions={handleAddSessions}
        />
      )}
    </div>
  )
}
