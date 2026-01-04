'use client'

import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'
import { Card, Badge, Spinner } from '@/components/ui'
import { cn } from '@/lib/utils/class'
import type { IssueWithProject, ProjectSettingsRecord } from '@/types/issue'

interface ProjectIssuesCardProps {
  projectId: string
  settingsVersion?: number
}

const DEFAULT_SETTINGS: Omit<ProjectSettingsRecord, 'project_id' | 'created_at' | 'updated_at'> = {
  issue_spec_threshold: 3,
  issue_tracking_enabled: true,
  spec_guidelines: null,
  // Widget defaults (not displayed in this component)
  widget_variant: 'popup',
  widget_theme: 'light',
  widget_position: 'bottom-right',
  widget_title: 'Support',
  widget_initial_message: 'Hi! How can I help you today?',
  // Session lifecycle defaults
  session_idle_timeout_minutes: 5,
  session_goodbye_delay_seconds: 90,
  session_idle_response_timeout_seconds: 60,
}

export function ProjectIssuesCard({ projectId, settingsVersion }: ProjectIssuesCardProps) {
  const [issues, setIssues] = useState<IssueWithProject[]>([])
  const [settings, setSettings] = useState<ProjectSettingsRecord | null>(null)
  const [isLoadingIssues, setIsLoadingIssues] = useState(true)
  const [isLoadingSettings, setIsLoadingSettings] = useState(true)
  const [issuesError, setIssuesError] = useState<string | null>(null)
  const [settingsError, setSettingsError] = useState<string | null>(null)

  const fetchIssues = useCallback(async () => {
    setIsLoadingIssues(true)
    setIssuesError(null)
    try {
      const response = await fetch(`/api/issues?projectId=${projectId}&limit=5`, {
        cache: 'no-store',
      })
      if (!response.ok) {
        throw new Error('Failed to load issues')
      }
      const data = await response.json()
      setIssues(data.issues ?? [])
    } catch (err) {
      setIssuesError(err instanceof Error ? err.message : 'Failed to load issues')
    } finally {
      setIsLoadingIssues(false)
    }
  }, [projectId])

  const fetchSettings = useCallback(async () => {
    setIsLoadingSettings(true)
    setSettingsError(null)
    try {
      const response = await fetch(`/api/projects/${projectId}/settings`, {
        cache: 'no-store',
      })
      if (!response.ok) {
        throw new Error('Failed to load settings')
      }
      const data = await response.json()
      setSettings(data.settings ?? null)
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Failed to load settings')
    } finally {
      setIsLoadingSettings(false)
    }
  }, [projectId])

  useEffect(() => {
    void fetchIssues()
    void fetchSettings()
  }, [fetchIssues, fetchSettings, settingsVersion])

  const isLoading = isLoadingIssues || isLoadingSettings
  const displaySettings = settings ?? { ...DEFAULT_SETTINGS, project_id: projectId, created_at: '', updated_at: '' }

  return (
    <div className="lg:col-span-2">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-mono text-lg font-bold uppercase tracking-tight text-[color:var(--foreground)]">
          Issues Tracking
        </h3>
        <Link
          href={`/issues?project=${projectId}`}
          className="font-mono text-sm text-[color:var(--accent-primary)] hover:underline"
        >
          View all issues →
        </Link>
      </div>

      {/* Settings Section */}
      <div className="mb-6 space-y-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
          Settings
        </h4>
        
        {isLoadingSettings ? (
          <div className="flex items-center gap-2 text-sm text-[color:var(--text-secondary)]">
            <Spinner size="sm" />
            <span>Loading settings...</span>
          </div>
        ) : settingsError ? (
          <div className="text-sm text-[color:var(--accent-danger)]">
            {settingsError}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <SettingItem 
              label="Status" 
              value={
                <span className={ cn('font-mono text-sm text-[color:var(--foreground)]', displaySettings.issue_tracking_enabled ? 'text-green-500' : 'text-gray-500')}>
                  {displaySettings.issue_tracking_enabled ? 'Enabled' : 'Disabled'}
                </span>
              } 
            />
            <SettingItem 
              label="Spec threshold" 
              value={
                <span className="font-mono text-sm text-[color:var(--foreground)]">
                  {displaySettings.issue_spec_threshold} upvotes
                </span>
              } 
            />
            <SettingItem 
              label="Spec guidelines" 
              value={
                displaySettings.spec_guidelines ? (
                  <span 
                    className="text-sm text-[color:var(--foreground)] truncate max-w-[200px] block" 
                    title={displaySettings.spec_guidelines}
                  >
                    {displaySettings.spec_guidelines.length > 50 
                      ? `${displaySettings.spec_guidelines.substring(0, 50)}...` 
                      : displaySettings.spec_guidelines
                    }
                  </span>
                ) : (
                  <span className="text-sm text-[color:var(--text-tertiary)] italic">
                    Not set
                  </span>
                )
              } 
            />
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-[color:var(--border-subtle)] mb-6" />

      {/* Recent Issues Section */}
      <div className="space-y-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
          Recent Issues
        </h4>
        
        {isLoadingIssues ? (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        ) : issuesError ? (
          <div className="rounded-[4px] border-2 border-[color:var(--accent-danger)] bg-transparent p-4 font-mono text-sm text-[color:var(--foreground)]">
            {issuesError}
          </div>
        ) : issues.length === 0 ? (
          <div className="rounded-[4px] border-2 border-dashed border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-6 text-center">
            <p className="text-sm text-[color:var(--text-secondary)]">
              No issues yet. Issues will be created automatically when users report problems or request features.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[color:var(--border-subtle)] border border-[color:var(--border-subtle)] rounded-[4px] overflow-hidden">
            {issues.map((issue) => (
              <IssueRow key={issue.id} issue={issue} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface SettingItemProps {
  label: string
  value: React.ReactNode
}

function SettingItem({ label, value }: SettingItemProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-[color:var(--text-tertiary)]">
        {label}
      </span>
      {value}
    </div>
  )
}

interface IssueRowProps {
  issue: IssueWithProject
}

function IssueRow({ issue }: IssueRowProps) {
  const truncatedTitle = issue.title.length > 40 
    ? `${issue.title.slice(0, 40)}...` 
    : issue.title

  return (
    <Link
      href={`/issues?project=${issue.project_id}&issue=${issue.id}`}
      className="flex items-center justify-between bg-[color:var(--background)] px-3 py-2 transition hover:bg-[color:var(--surface-hover)]"
    >
      <div className="flex items-center gap-3">
        <Badge variant={getTypeVariant(issue.type)}>
          {formatIssueType(issue.type)}
        </Badge>
        <span className="text-sm font-medium text-[color:var(--foreground)]" title={issue.title}>
          {truncatedTitle}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant={getPriorityVariant(issue.priority)}>
          {issue.priority}
        </Badge>
        <Badge variant={getStatusVariant(issue.status)}>
          {formatStatus(issue.status)}
        </Badge>
        <span className="text-xs text-[color:var(--text-tertiary)]">
          {formatRelativeTime(issue.updated_at)}
        </span>
      </div>
    </Link>
  )
}

function getTypeVariant(type: string): 'default' | 'success' | 'warning' | 'danger' {
  switch (type) {
    case 'bug':
      return 'danger'
    case 'feature_request':
      return 'success'
    case 'change_request':
      return 'warning'
    default:
      return 'default'
  }
}

function formatIssueType(type: string): string {
  switch (type) {
    case 'bug':
      return 'Bug'
    case 'feature_request':
      return 'Feature'
    case 'change_request':
      return 'Change'
    default:
      return type
  }
}

function getPriorityVariant(priority: string): 'default' | 'success' | 'warning' | 'danger' {
  switch (priority) {
    case 'high':
      return 'danger'
    case 'medium':
      return 'warning'
    case 'low':
      return 'default'
    default:
      return 'default'
  }
}

function getStatusVariant(status: string): 'default' | 'success' | 'warning' | 'danger' {
  switch (status) {
    case 'open':
      return 'warning'
    case 'in_progress':
      return 'default'
    case 'resolved':
      return 'success'
    case 'closed':
      return 'default'
    default:
      return 'default'
  }
}

function formatStatus(status: string): string {
  switch (status) {
    case 'in_progress':
      return 'In Progress'
    default:
      return status.charAt(0).toUpperCase() + status.slice(1)
  }
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) {
    return 'Just now'
  } else if (diffMins < 60) {
    return `${diffMins}m ago`
  } else if (diffHours < 24) {
    return `${diffHours}h ago`
  } else if (diffDays < 7) {
    return `${diffDays}d ago`
  } else {
    return date.toLocaleDateString()
  }
}
