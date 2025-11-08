'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { ProjectWithCodebase } from '@/lib/projects/queries'
import { useProjectDetail } from '@/hooks/use-projects'
import { ProjectDetailsCard } from './project-details-card'
import { ProjectKeysCard } from './project-keys-card'
import { ProjectSessionsCard } from './project-sessions-card'
import { KnowledgeManagementCard } from './knowledge-management-card'
import { EditProjectDialog } from './edit-project-dialog'
import { TestAgentDialog } from './test-agent-dialog'

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

        <header className="flex flex-col gap-5 rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--background)] p-8 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <h1 className="font-mono text-3xl font-bold uppercase tracking-tight text-[color:var(--foreground)]">
              {project?.name ?? initialProject.name}
            </h1>
            <p className="max-w-xl text-sm text-[color:var(--text-secondary)]">
              View project details and manage source code.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setIsTesting(true)}
              className="rounded-[4px] border-2 border-[color:var(--accent-selected)] bg-[color:var(--accent-selected)] px-5 py-3 font-mono text-sm font-semibold uppercase tracking-wide text-white transition hover:opacity-90"
            >
              Test agent
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-transparent px-5 py-3 font-mono text-sm font-semibold uppercase tracking-wide text-[color:var(--foreground)] transition hover:border-[color:var(--border)] hover:bg-[color:var(--surface-hover)]"
            >
              Edit project
            </button>
          </div>
        </header>

        <section className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
          <ProjectDetailsCard project={project ?? initialProject} isLoading={isLoading} />
          <ProjectKeysCard project={project ?? initialProject} isLoading={isLoading} />
        </section>

        <KnowledgeManagementCard
          projectId={projectId}
          hasCodebase={Boolean((project ?? initialProject).source_code)}
        />

        <ProjectSessionsCard projectId={projectId} />
      </div>

      {project && isEditing && (
        <EditProjectDialog
          project={project}
          onClose={() => setIsEditing(false)}
          onSaved={async () => {
            await refresh()
            setIsEditing(false)
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
