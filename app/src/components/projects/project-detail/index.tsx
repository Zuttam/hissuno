'use client'

import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { ProjectWithCodebase } from '@/lib/projects/queries'
import type { IntegrationStats } from '@/lib/supabase/sessions'
import { useProjectDetail } from '@/hooks/use-projects'
import { FloatingCard } from '@/components/ui/floating-card'
import { ProjectHeader } from './project-header'
import { ProjectSessionsCard } from './project-sessions-card'
import { ProjectIssuesCard } from './project-issues-card'
import { KnowledgeManagementCard } from './knowledge-management-card'
import { TestAgentDialog } from './test-agent-dialog'

interface ProjectDetailProps {
  projectId: string
  initialProject: ProjectWithCodebase
}

export function ProjectDetail({ projectId, initialProject }: ProjectDetailProps) {
  const router = useRouter()
  const { project, isLoading, error, refresh } = useProjectDetail({
    projectId,
    initialProject,
  })
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

  // Handle edit navigation
  const handleEditProject = useCallback(() => {
    router.push(`/projects/${projectId}/edit`)
  }, [router, projectId])

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

        <FloatingCard floating="gentle" className="p-8">
          <ProjectHeader
            project={project ?? initialProject}
            integrationStats={integrationStats}
            isLoading={isLoading}
            onRefresh={refresh}
            onTestAgent={() => setIsTesting(true)}
            onEditProject={handleEditProject}
          />
        </FloatingCard>
        <FloatingCard floating="gentle">
          <KnowledgeManagementCard
            projectId={projectId}
            onTestAgent={() => setIsTesting(true)}
          />
        </FloatingCard>
        <FloatingCard floating="gentle">
          <ProjectIssuesCard projectId={projectId} settingsVersion={settingsVersion} />
        </FloatingCard>
        <FloatingCard floating="gentle">
          <ProjectSessionsCard projectId={projectId} />
        </FloatingCard>
      </div>

      {project && isTesting && (
        <TestAgentDialog
          project={project}
          onClose={() => setIsTesting(false)}
        />
      )}
    </div>
  )
}
