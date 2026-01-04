'use client'

import type { ProjectWithCodebase } from '@/lib/projects/queries'
import type { IntegrationStats } from '@/lib/supabase/sessions'
import { Button, KeyField } from '@/components/ui'
import { CodebaseSection } from './codebase-section'
import { IntegrationsSection } from './integrations-section'
import { formatTimestamp } from './utils'

interface ProjectHeaderProps {
  project: ProjectWithCodebase
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
  return (
    <>
      {/* Top row: Info + Buttons */}
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <div className="space-y-1">
            <h1 className="font-mono text-3xl font-bold uppercase tracking-tight text-[color:var(--foreground)]">
              {project.name}
            </h1>
            {project.description && (
              <p className="max-w-xl text-sm text-[color:var(--text-secondary)]">
                {project.description}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-[color:var(--text-tertiary)]">
            <span>
              <span className="uppercase tracking-wide text-[color:var(--text-secondary)]">Created:</span>{' '}
              {formatTimestamp(project.created_at)}
            </span>
            <span>
              <span className="uppercase tracking-wide text-[color:var(--text-secondary)]">Updated:</span>{' '}
              {formatTimestamp(project.updated_at)}
            </span>
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
            variant="ghost"
            className="whitespace-nowrap"
            onClick={onEditProject}
          >
            Edit project
          </Button>
        </div>
      </div>

      {/* Keys Section */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 pt-4 border-t border-[color:var(--border-subtle)]">
        <KeyField
          label="Project ID"
          value={project.id}
          compact
        />
        <KeyField
          label="Public Key"
          value={project.public_key ?? 'Not generated'}
          disabled={!project.public_key}
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

      {/* Codebase Section */}
      <CodebaseSection
        project={project}
        isLoading={isLoading}
        onRefresh={onRefresh}
      />

      {/* Integrations Section */}
      <IntegrationsSection
        project={project}
        integrationStats={integrationStats}
        isLoading={isLoading}
      />
    </>
  )
}
