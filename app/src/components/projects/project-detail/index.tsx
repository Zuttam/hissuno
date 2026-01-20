'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { ProjectRecord } from '@/lib/supabase/projects'
import type { IntegrationStats } from '@/lib/supabase/sessions'
import { useProjectDetail } from '@/hooks/use-projects'
import { FloatingCard } from '@/components/ui/floating-card'
import { ProjectsAnalyticsStrip } from '@/components/analytics'
import { ProjectHeader } from './project-header'
import { ProjectSessionsCard } from './project-sessions-card'
import { ProjectIssuesCard } from './project-issues-card'
import { KnowledgeManagementCard } from './knowledge-management-card'
import { TestAgentDialog } from './test-agent-dialog'

interface ProjectDetailProps {
  projectId: string
  initialProject: ProjectRecord
}

export function ProjectDetail({ projectId, initialProject }: ProjectDetailProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { project, isLoading, error, refresh } = useProjectDetail({
    projectId,
    initialProject,
  })
  const [isTesting, setIsTesting] = useState(() => searchParams.get('test') === 'true')
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

  // Handle test agent modal - update URL to keep state in sync
  const handleOpenTestAgent = useCallback(() => {
    setIsTesting(true)
    router.replace(`/projects/${projectId}?test=true`, { scroll: false })
  }, [router, projectId])

  const handleCloseTestAgent = useCallback(() => {
    setIsTesting(false)
    router.replace(`/projects/${projectId}`, { scroll: false })
  }, [router, projectId])

  return (
    <div>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        {error && (
          <div className="rounded-[4px] border-2 border-[color:var(--accent-danger)] bg-transparent p-4 font-mono text-sm text-[color:var(--foreground)]">
            {error}
          </div>
        )}

        <ProjectHeader
          project={project ?? initialProject}
          integrationStats={integrationStats}
          isLoading={isLoading}
          onRefresh={refresh}
          onTestAgent={handleOpenTestAgent}
          onEditProject={handleEditProject}
        />
        <ProjectsAnalyticsStrip projectId={projectId} />
        <FloatingCard floating="gentle">
          <KnowledgeManagementCard
            projectId={projectId}
            onTestAgent={handleOpenTestAgent}
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
          onClose={handleCloseTestAgent}
        />
      )}
    </div>
  )
}
