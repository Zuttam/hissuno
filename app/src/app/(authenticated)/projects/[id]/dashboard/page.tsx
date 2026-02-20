'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useProject } from '@/components/providers/project-provider'
import { ProjectAnalytics } from '@/components/analytics/project-analytics'
import { ProjectDetailsDialog } from '@/components/projects/edit-dialogs/project-details-dialog'
import { Card } from '@/components/ui/card'
import { SectionHeader } from '@/components/ui/section-header'
import { Button, PageHeader, Spinner } from '@/components/ui'
import { useDashboardData } from '@/hooks/use-dashboard-data'
import { IssuePipeline } from '@/components/dashboard/issue-pipeline'
import { TopIssuesList } from '@/components/dashboard/top-issues-list'
import { PendingReviews } from '@/components/dashboard/pending-reviews'

export default function DashboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { project, projectId, isLoading, refreshProject, refreshProjects } = useProject()
  const [showEditDialog, setShowEditDialog] = useState(false)
  const hasPendingSave = useRef(false)
  const { data: dashboardData, isLoading: dashboardLoading } = useDashboardData({
    projectId: projectId ?? '',
  })

  // Auto-open dialog based on URL param
  useEffect(() => {
    const dialog = searchParams.get('dialog')
    if (dialog === 'edit') {
      setShowEditDialog(true)
    }
  }, [searchParams])

  // Clear URL param when dialog closes
  const handleCloseEditDialog = () => {
    setShowEditDialog(false)
    if (searchParams.get('dialog')) {
      router.replace(`/projects/${projectId}/dashboard`)
    }
    if (hasPendingSave.current) {
      hasPendingSave.current = false
      void refreshProject()
      void refreshProjects()
    }
  }

  const handleProjectSaved = () => {
    hasPendingSave.current = true
  }

  const handleOpenEditDialog = () => {
    router.push(`/projects/${projectId}/dashboard?dialog=edit`)
  }

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
      <PageHeader
        title="Dashboard"
        actions={
          <Button
            variant="secondary"
            size="md"
            onClick={handleOpenEditDialog}
          >
            Edit Project
          </Button>
        }
      />

      {/* Actionable Section */}
      <Card>
        <SectionHeader title="In a Glance" titleAs="h3" />
        {dashboardLoading ? (
          <div className="flex min-h-[150px] items-center justify-center">
            <Spinner size="md" />
          </div>
        ) : dashboardData ? (
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <IssuePipeline stats={dashboardData.pipeline} projectId={projectId} />
            <TopIssuesList issues={dashboardData.topIssues} projectId={projectId} />
            <PendingReviews
              sessions={dashboardData.pendingReviews.sessions}
              count={dashboardData.pendingReviews.count}
              projectId={projectId}
            />
          </div>
        ) : null}
      </Card>

      {/* Analytics Section */}
      <Card className="mt-6">
        <SectionHeader title="Analytics" titleAs="h3" />
        <ProjectAnalytics
          projectId={projectId}
          velocityData={dashboardData?.velocity}
        />
      </Card>

      <ProjectDetailsDialog
        open={showEditDialog}
        onClose={handleCloseEditDialog}
        projectId={projectId}
        initialName={project.name}
        initialDescription={project.description || ''}
        onSaved={handleProjectSaved}
      />
    </>
  )
}
