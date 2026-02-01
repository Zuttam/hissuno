'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useProject } from '@/components/providers/project-provider'
import { PackageList } from '@/components/projects/knowledge/package-list'
import { KnowledgeSourcesList } from '@/components/projects/knowledge/knowledge-sources-list'
import { KnowledgeSourcesDialog } from '@/components/projects/edit-dialogs/knowledge-sources-dialog'
import { FloatingCard } from '@/components/ui/floating-card'
import { Button, PageHeader, Spinner, Badge, Alert, Heading } from '@/components/ui'
import type { KnowledgeSourceRecord } from '@/lib/knowledge/types'

export default function KnowledgePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { project, projectId, isLoading } = useProject()
  const [showSourcesDialog, setShowSourcesDialog] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // Active package state
  const [activePackageId, setActivePackageId] = useState<string | null>(null)
  const [isLoadingSettings, setIsLoadingSettings] = useState(true)

  // Sources state
  const [sources, setSources] = useState<KnowledgeSourceRecord[]>([])
  const [isLoadingSources, setIsLoadingSources] = useState(true)

  // Fetch support agent settings to get active package
  const fetchSettings = useCallback(async () => {
    if (!projectId) return
    setIsLoadingSettings(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/settings/support-agent`)
      if (response.ok) {
        const data = await response.json()
        setActivePackageId(data.settings?.support_agent_package_id ?? null)
      }
    } catch (err) {
      console.error('[knowledge] Failed to fetch settings:', err)
    } finally {
      setIsLoadingSettings(false)
    }
  }, [projectId])

  // Fetch knowledge sources
  const fetchSources = useCallback(async () => {
    if (!projectId) return
    setIsLoadingSources(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/settings/knowledge-sources`)
      if (response.ok) {
        const data = await response.json()
        setSources(data.sources ?? [])
      }
    } catch (err) {
      console.error('[knowledge] Failed to fetch sources:', err)
    } finally {
      setIsLoadingSources(false)
    }
  }, [projectId])

  useEffect(() => {
    void fetchSettings()
    void fetchSources()
  }, [fetchSettings, fetchSources])

  // Auto-open dialog based on URL param
  useEffect(() => {
    const dialog = searchParams.get('dialog')
    if (dialog === 'sources') {
      setShowSourcesDialog(true)
    }
  }, [searchParams])

  // Clear URL param when dialog closes
  const handleCloseSourcesDialog = () => {
    setShowSourcesDialog(false)
    if (searchParams.get('dialog')) {
      router.replace(`/projects/${projectId}/knowledge`)
    }
  }

  const handleSourcesSaved = () => {
    // Increment key to force KnowledgeManagementCard to refresh
    setRefreshKey(prev => prev + 1)
    void fetchSources()
  }

  const handlePackagesChange = () => {
    setRefreshKey(prev => prev + 1)
    void fetchSettings()
  }

  // Handlers for opening dialogs
  const handleOpenSourcesDialog = () => {
    router.push(`/projects/${projectId}/knowledge?dialog=sources`)
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
      <PageHeader title="Knowledge" />

      {/* Card 1: Connected Resources */}
      <FloatingCard floating="gentle">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Heading as="h3" size="subsection">Connected Resources</Heading>
            {sources.length > 0 && <Badge variant="default">{sources.length}</Badge>}
          </div>
          <Button variant="secondary" size="sm" onClick={handleOpenSourcesDialog}>
            Configure
          </Button>
        </div>

        <KnowledgeSourcesList
          sources={sources}
          isLoading={isLoadingSources}
          onConfigure={handleOpenSourcesDialog}
        />
      </FloatingCard>

      {/* Card 2: Knowledge Packages */}
      <FloatingCard floating="gentle">
        {isLoadingSettings ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <>
            <PackageList
              projectId={projectId}
              activePackageId={activePackageId}
              onPackagesChange={handlePackagesChange}
              hasResources={sources.length > 0}
            />

            {/* Info about connecting packages */}
            {activePackageId === null && (
              <div className="mt-4">
                <Alert variant="info">
                  To connect a package to the support agent, go to the <span className="font-semibold">Agents</span> page and select a package.
                </Alert>
              </div>
            )}
          </>
        )}
      </FloatingCard>

      <KnowledgeSourcesDialog
        open={showSourcesDialog}
        onClose={handleCloseSourcesDialog}
        projectId={projectId}
        onSaved={handleSourcesSaved}
      />
    </>
  )
}
