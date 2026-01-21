'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useProject } from '@/components/providers/project-provider'
import { ProjectAnalytics } from '@/components/analytics/project-analytics'
import { ProjectDetailsDialog } from '@/components/projects/edit-dialogs/project-details-dialog'
import { FloatingCard } from '@/components/ui/floating-card'
import { Button, PageHeader, Spinner } from '@/components/ui'

export default function DashboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { project, projectId, isLoading } = useProject()
  const [showEditDialog, setShowEditDialog] = useState(false)

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
  }

  const handleProjectSaved = () => {
    // Refresh the page to get updated project data
    router.refresh()
  }

  // Handler for opening dialog - updates URL for consistent tracking
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
      
      <FloatingCard floating="gentle">
        <ProjectAnalytics projectId={projectId} />
      </FloatingCard>

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
