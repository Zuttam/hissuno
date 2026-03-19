'use client'

import { useProject } from '@/components/providers/project-provider'
import { ProjectAnalytics } from '@/components/analytics/project-analytics'
import { Card } from '@/components/ui/card'
import { SectionHeader } from '@/components/ui/section-header'
import { PageHeader, Spinner } from '@/components/ui'
import { useDashboardData } from '@/hooks/use-dashboard-data'
import { EntityGraph } from '@/components/analytics/entity-graph'

export default function DashboardPage() {
  const { project, projectId, isLoading } = useProject()
  const { data: dashboardData } = useDashboardData({
    projectId: projectId ?? '',
  })

  // Show loading state while project is being fetched
  if (isLoading || !project || !projectId) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <div className="flex-1 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader title="Dashboard" />

      <EntityGraph projectId={projectId} />

      {/* Analytics Section */}
      <Card>
        <SectionHeader title="Analytics" titleAs="h3" />
        <ProjectAnalytics
          projectId={projectId}
          velocityData={dashboardData?.velocity}
        />
      </Card>
    </>
  )
}
