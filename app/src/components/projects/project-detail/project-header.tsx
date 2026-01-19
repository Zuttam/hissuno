'use client'

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import type { ProjectRecord } from '@/lib/supabase/projects'
import type { IntegrationStats } from '@/lib/supabase/sessions'
import { Badge, Button, KeyField, Text } from '@/components/ui'
import { formatTimestamp } from './utils'

type IntegrationStatus = 'active' | 'idle' | 'inactive'

interface ProjectHeaderProps {
  project: ProjectRecord
  integrationStats: IntegrationStats | null
  isLoading: boolean
  onRefresh: () => Promise<void>
  onTestAgent: () => void
  onEditProject: () => void
}

export function ProjectHeader({
  project,
  integrationStats,
  isLoading,
  onRefresh,
  onTestAgent,
  onEditProject,
}: ProjectHeaderProps) {
  const [slackConnected, setSlackConnected] = useState(false)
  const [githubConnected, setGithubConnected] = useState(false)

  // Fetch integration statuses
  const fetchIntegrationStatuses = useCallback(async () => {
    try {
      const [slackRes, githubRes] = await Promise.all([
        fetch(`/api/integrations/slack?projectId=${project.id}`),
        fetch(`/api/integrations/github?projectId=${project.id}`),
      ])

      if (slackRes.ok) {
        const data = await slackRes.json()
        setSlackConnected(data.connected)
      }

      if (githubRes.ok) {
        const data = await githubRes.json()
        setGithubConnected(data.connected)
      }
    } catch {
      // Silently fail - status indicators are non-critical
    }
  }, [project.id])

  useEffect(() => {
    fetchIntegrationStatuses()
  }, [fetchIntegrationStatuses])

  const hasRecentActivity = integrationStats?.isActive ?? false
  const widgetStatus: IntegrationStatus = hasRecentActivity ? 'active' : 'idle'

  return (
    <div className="space-y-4">
      {/* Top row: Info + Buttons */}
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-3xl font-bold uppercase tracking-tight text-[color:var(--foreground)]">
              {project.name}
            </h1>
            {/* Integration badges */}
            <div className="flex flex-wrap gap-1.5">
              <IntegrationBadge
                status={widgetStatus}
                name="Widget"
                icon={<WidgetIcon />}
              />
              <IntegrationBadge
                status={githubConnected ? 'active' : 'inactive'}
                name="GitHub"
                icon={<GitHubIcon />}
              />
              <IntegrationBadge
                status={slackConnected ? 'active' : 'inactive'}
                name="Slack"
                icon={<SlackIcon />}
              />
            </div>
          </div>
          {project.description && (
            <p className="max-w-xl text-sm text-[color:var(--text-secondary)]">
              {project.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Text as="span" size="xs" mono className="text-[color:var(--text-tertiary)]">
              Created {formatTimestamp(project.created_at)}
            </Text>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-2">
            <KeyField
              label="Project ID"
              value={project.id}
              compact
            />
            <KeyField
              label="Secret Key"
              value={project.secret_key ?? 'Not generated'}
              disabled={!project.secret_key}
              isSecret
              compact
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            variant="primary"
            selected
            className="whitespace-nowrap"
            onClick={onTestAgent}
          >
            Test agent
          </Button>
          <Button
            variant="secondary"
            className="whitespace-nowrap"
            onClick={onEditProject}
          >
            Edit project
          </Button>
        </div>
      </div>
    </div>
  )
}

// Integration Badge Component
interface IntegrationBadgeProps {
  status: IntegrationStatus
  name: string
  icon: ReactNode
}

function IntegrationBadge({ status, name, icon }: IntegrationBadgeProps) {
  const statusColors = {
    active: 'bg-emerald-500',
    idle: 'bg-amber-500',
    inactive: 'bg-gray-500',
  }

  return (
    <Badge filled className="gap-1.5 py-1">
      <span className={`h-1.5 w-1.5 rounded-full ${statusColors[status]}`} />
      {icon}
      <span>{name}</span>
    </Badge>
  )
}

// Icon Components
function WidgetIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="#3B82F6"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
      />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"
      />
    </svg>
  )
}

function SlackIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24">
      {/* Slack brand colors: #E01E5A (pink), #36C5F0 (blue), #2EB67D (green), #ECB22E (yellow) */}
      <path fill="#E01E5A" d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" />
      <path fill="#36C5F0" d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" />
      <path fill="#2EB67D" d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" />
      <path fill="#ECB22E" d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
    </svg>
  )
}
