'use client'

import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import type { ProjectWithCodebase } from '@/lib/projects/queries'
import type { IntegrationStats } from '@/lib/supabase/sessions'
import { useProjectDetail } from '@/hooks/use-projects'
import { Card } from '@/components/ui'
import { ProjectHeader } from './project-header'
import { ProjectSessionsCard } from './project-sessions-card'
import { ProjectIssuesCard } from './project-issues-card'
import { KnowledgeManagementCard } from './knowledge-management-card'
import { EditProjectDialog } from './edit-project-dialog'
import { TestAgentDialog } from './test-agent-dialog'

interface ProjectDetailProps {
  projectId: string
  initialProject: ProjectWithCodebase
}

export function ProjectDetail({ projectId, initialProject }: ProjectDetailProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { project, isLoading, error, refresh } = useProjectDetail({
    projectId,
    initialProject,
  })
  const [isEditing, setIsEditing] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [settingsVersion, setSettingsVersion] = useState(0)
  const [integrationStats, setIntegrationStats] = useState<IntegrationStats | null>(null)

  // Fetch integration stats for widget status indicator
  const fetchIntegrationStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions?projectId=${projectId}&stats=true`)
      if (res.ok) {
        const data = await res.json()
        setIntegrationStats(data.stats)
      }
    } catch {
      // Silently fail - stats are optional
    }
  }, [projectId])

  useEffect(() => {
    fetchIntegrationStats()
  }, [fetchIntegrationStats])

  // Auto-open edit dialog if redirected back from GitHub OAuth
  useEffect(() => {
    if (searchParams.get('editing') === 'true') {
      setIsEditing(true)
      // Clean up URL
      router.replace(`/projects/${projectId}`, { scroll: false })
    }
  }, [searchParams, projectId, router])

  return (
    <div>
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

        <Card className="border-2 border-[color:var(--border-subtle)] bg-[color:var(--background)] p-8">
          <ProjectHeader
            project={project ?? initialProject}
            integrationStats={integrationStats}
            isLoading={isLoading}
            onRefresh={refresh}
            onTestAgent={() => setIsTesting(true)}
            onEditProject={() => setIsEditing(true)}
          />
        </Card>
        <Card className="border-2 border-[color:var(--border-subtle)] bg-[color:var(--background)]">
          <KnowledgeManagementCard
            projectId={projectId}
          />
        </Card>
        <Card className="border-2 border-[color:var(--border-subtle)] bg-[color:var(--background)]">
        <ProjectIssuesCard projectId={projectId} settingsVersion={settingsVersion} />
        </Card>
        <Card className="border-2 border-[color:var(--border-subtle)] bg-[color:var(--background)]">
          <ProjectSessionsCard projectId={projectId} />
        </Card>
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
