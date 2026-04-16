'use client'

import { useProject } from '@/components/providers/project-provider'
import { ProjectAnalytics } from '@/components/analytics/project-analytics'
import { PageHeader, Spinner } from '@/components/ui'
import { useDashboardData } from '@/hooks/use-dashboard-data'

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

      <ProjectAnalytics
        projectId={projectId}
        velocityData={dashboardData?.velocity}
      />
    </>
  )
}
