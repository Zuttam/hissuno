'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useProject } from '@/components/providers/project-provider'
import { KnowledgeManagementCard } from '@/components/projects/knowledge/knowledge-management-card'
import { TestAgentDialog } from '@/components/projects/test-agent-dialog'
import { KnowledgeSourcesDialog } from '@/components/projects/edit-dialogs/knowledge-sources-dialog'
import { FloatingCard } from '@/components/ui/floating-card'
import { Button, PageHeader, Spinner } from '@/components/ui'

export default function KnowledgePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { project, projectId, isLoading } = useProject()
  const [showTestAgent, setShowTestAgent] = useState(false)
  const [showSourcesDialog, setShowSourcesDialog] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // Auto-open dialog based on URL param
  useEffect(() => {
    const dialog = searchParams.get('dialog')
    if (dialog === 'sources') {
      setShowSourcesDialog(true)
    } else if (dialog === 'test-agent') {
      setShowTestAgent(true)
    }
  }, [searchParams])

  // Clear URL param when dialog closes
  const handleCloseSourcesDialog = () => {
    setShowSourcesDialog(false)
    if (searchParams.get('dialog')) {
      router.replace(`/projects/${projectId}/knowledge`)
    }
  }

  const handleCloseTestAgent = () => {
    setShowTestAgent(false)
    if (searchParams.get('dialog')) {
      router.replace(`/projects/${projectId}/knowledge`)
    }
  }

  const handleSourcesSaved = () => {
    // Increment key to force KnowledgeManagementCard to refresh
    setRefreshKey(prev => prev + 1)
  }

  // Handlers for opening dialogs - updates URL for consistent tracking
  const handleOpenSourcesDialog = () => {
    router.push(`/projects/${projectId}/knowledge?dialog=sources`)
  }

  const handleOpenTestAgent = () => {
    router.push(`/projects/${projectId}/knowledge?dialog=test-agent`)
  }

  // Show loading state while project is being fetched
  if (isLoading || !project || !projectId) {
    return (
      <>
        <PageHeader title="Knowledge" />
        <div className="flex-1 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Knowledge"
        actions={
          <>
            <Button
              variant="secondary"
              size="md"
              onClick={handleOpenSourcesDialog}
            >
              Configure
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleOpenTestAgent}
            >
              Test Agent
            </Button>
          </>
        }
      />

      <FloatingCard floating="gentle">
        <KnowledgeManagementCard
          key={refreshKey}
          projectId={projectId}
          onTestAgent={handleOpenTestAgent}
        />
      </FloatingCard>

      {showTestAgent && (
        <TestAgentDialog
          project={project}
          onClose={handleCloseTestAgent}
        />
      )}

      <KnowledgeSourcesDialog
        open={showSourcesDialog}
        onClose={handleCloseSourcesDialog}
        projectId={projectId}
        onSaved={handleSourcesSaved}
      />
    </>
  )
}
