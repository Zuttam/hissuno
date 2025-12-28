'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { ProjectWithCodebase } from '@/lib/projects/queries'
import { useProjectDetail } from '@/hooks/use-projects'
import { Button, KeyField } from '@/components/ui'
import { CodebaseSection } from './codebase-section'
import { IntegrationsSection } from './integrations-section'
import { ProjectSessionsCard } from './project-sessions-card'
import { ProjectIssuesCard } from './project-issues-card'
import { KnowledgeManagementCard } from './knowledge-management-card'
import { EditProjectDialog } from './edit-project-dialog'
import { TestAgentDialog } from './test-agent-dialog'
import { formatTimestamp } from './utils'

interface ProjectDetailProps {
  projectId: string
  initialProject: ProjectWithCodebase
}

export function ProjectDetail({ projectId, initialProject }: ProjectDetailProps) {
  const { project, isLoading, error, refresh } = useProjectDetail({
    projectId,
    initialProject,
  })
  const [isEditing, setIsEditing] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [settingsVersion, setSettingsVersion] = useState(0)

  return (
    <div className="min-h-screen bg-[color:var(--background)] px-6 py-5">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <nav className="font-mono text-sm text-[color:var(--text-secondary)]">
          <Link href="/projects" className="hover:text-[color:var(--foreground)]">
            ← Back to projects
          </Link>
        </nav>

        {error && (
          <div className="rounded-[4px] border-2 border-[color:var(--accent-danger)] bg-transparent p-4 font-mono text-sm text-[color:var(--foreground)]">
            {error}
          </div>
        )}

        <header className="flex flex-col gap-5 rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--background)] p-8">
          {/* Top row: Info + Buttons */}
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <div className="space-y-1">
                <h1 className="font-mono text-3xl font-bold uppercase tracking-tight text-[color:var(--foreground)]">
                  {project?.name ?? initialProject.name}
                </h1>
                {(project?.description ?? initialProject.description) && (
                  <p className="max-w-xl text-sm text-[color:var(--text-secondary)]">
                    {project?.description ?? initialProject.description}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-[color:var(--text-tertiary)]">
                <span>
                  <span className="uppercase tracking-wide text-[color:var(--text-secondary)]">Created:</span>{' '}
                  {formatTimestamp((project ?? initialProject).created_at)}
                </span>
                <span>
                  <span className="uppercase tracking-wide text-[color:var(--text-secondary)]">Updated:</span>{' '}
                  {formatTimestamp((project ?? initialProject).updated_at)}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                variant="primary"
                selected
                className="whitespace-nowrap"
                onClick={() => setIsTesting(true)}
              >
                Test agent
              </Button>
              <Button
                variant="ghost"
                className="whitespace-nowrap"
                onClick={() => setIsEditing(true)}
              >
                Edit project
              </Button>
            </div>
          </div>

          {/* Keys Section */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 pt-4 border-t border-[color:var(--border-subtle)]">
            <KeyField
              label="Project ID"
              value={(project ?? initialProject).id}
              compact
            />
            <KeyField
              label="Public Key"
              value={(project ?? initialProject).public_key ?? 'Not generated'}
              disabled={!(project ?? initialProject).public_key}
              compact
            />
            <KeyField
              label="Secret Key"
              value={(project ?? initialProject).secret_key ?? 'Not generated'}
              disabled={!(project ?? initialProject).secret_key}
              isSecret
              compact
            />
          </div>

          {/* Codebase Section */}
          <CodebaseSection
            project={project ?? initialProject}
            isLoading={isLoading}
            onRefresh={refresh}
          />

          {/* Integrations Section */}
          <IntegrationsSection
            project={project ?? initialProject}
            isLoading={isLoading}
          />
        </header>

        <KnowledgeManagementCard
          projectId={projectId}
          hasCodebase={Boolean((project ?? initialProject).source_code)}
        />

        <ProjectIssuesCard projectId={projectId} settingsVersion={settingsVersion} />

        <ProjectSessionsCard projectId={projectId} />
      </div>

      {project && isEditing && (
        <EditProjectDialog
          project={project}
          onClose={() => setIsEditing(false)}
          onSaved={async () => {
            await refresh()
            setSettingsVersion((v) => v + 1)
          }}
        />
      )}

      {project && isTesting && (
        <TestAgentDialog
          project={project}
          onClose={() => setIsTesting(false)}
        />
      )}
    </div>
  )
}
