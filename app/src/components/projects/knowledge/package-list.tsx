'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Button, Spinner, Heading } from '@/components/ui'
import { PackageDialog } from './package-dialog'
import { PackageListItem } from './package-list-item'
import { usePackageAnalysis } from '@/hooks/use-package-analysis'
import { listPackages, getPackageAnalysisStatus } from '@/lib/api/support-packages'
import type { SupportPackageWithSources } from '@/lib/knowledge/types'

interface PackageListProps {
  projectId: string
  activePackageId: string | null
  onPackagesChange?: () => void
  hasResources?: boolean
  initialExpandedPackageId?: string | null
  onPackageSelect?: (packageId: string) => void
  showCreateDialog?: boolean
  onCreateDialogClose?: () => void
  onCreatePackage?: () => void
  onEditPackage?: (pkg: SupportPackageWithSources) => void
}

export function PackageList({ projectId, activePackageId, onPackagesChange, hasResources = true, initialExpandedPackageId, onPackageSelect, showCreateDialog: showCreateDialogProp, onCreateDialogClose, onCreatePackage, onEditPackage }: PackageListProps) {
  const [packages, setPackages] = useState<SupportPackageWithSources[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [settingsPackage, setSettingsPackage] = useState<SupportPackageWithSources | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  // Sync showCreateDialog with parent prop
  useEffect(() => {
    if (showCreateDialogProp !== undefined) {
      setShowCreateDialog(showCreateDialogProp)
    }
  }, [showCreateDialogProp])

  // Sort packages: active package first in selection mode
  const sortedPackages = useMemo(() => {
    if (!onPackageSelect || !activePackageId) return packages
    return [...packages].sort((a, b) => {
      if (a.id === activePackageId) return -1
      if (b.id === activePackageId) return 1
      return 0
    })
  }, [packages, activePackageId, onPackageSelect])

  // Inline expansion state
  const [expandedPackageId, setExpandedPackageId] = useState<string | null>(initialExpandedPackageId ?? null)
  const [analyzingPackageId, setAnalyzingPackageId] = useState<string | null>(null)

  // Analysis hook
  const {
    isAnalyzing,
    events: analysisEvents,
    triggerAnalysis,
    cancelAnalysis,
  } = usePackageAnalysis({
    projectId,
    packageId: analyzingPackageId,
    checkOnMount: true,
    onAnalysisComplete: () => {
      // Refresh packages
      void fetchPackages()
      setAnalyzingPackageId(null)
      onPackagesChange?.()
    },
  })

  const fetchPackages = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await listPackages(projectId)
      const pkgs = data.packages ?? []
      setPackages(pkgs)
      return pkgs as SupportPackageWithSources[]
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      return []
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  // Check for running analysis across all packages
  const checkRunningAnalysis = useCallback(
    async (pkgs: SupportPackageWithSources[]) => {
      for (const pkg of pkgs) {
        try {
          const response = await getPackageAnalysisStatus(projectId, pkg.id)
          if (!response.ok) continue
          const data = await response.json()
          if (data.isRunning) {
            // Found a running analysis, set it
            setAnalyzingPackageId(pkg.id)
            return
          }
        } catch {
          // Ignore errors, continue checking
        }
      }
    },
    [projectId]
  )

  // Sync expandedPackageId when initialExpandedPackageId changes (e.g., dialog re-opens)
  useEffect(() => {
    if (initialExpandedPackageId) {
      setExpandedPackageId(initialExpandedPackageId)
    }
  }, [initialExpandedPackageId])

  useEffect(() => {
    const init = async () => {
      const pkgs = await fetchPackages()
      if (pkgs.length > 0) {
        void checkRunningAnalysis(pkgs)
      }
    }
    void init()
  }, [fetchPackages, checkRunningAnalysis])

  // Handle package expansion toggle
  const handleToggleExpand = (pkg: SupportPackageWithSources) => {
    if (expandedPackageId === pkg.id) {
      setExpandedPackageId(null)
    } else {
      setExpandedPackageId(pkg.id)
    }
  }

  const handleSettingsClick = (e: React.MouseEvent, pkg: SupportPackageWithSources) => {
    e.stopPropagation()
    if (onEditPackage) {
      onEditPackage(pkg)
    } else {
      setSettingsPackage(pkg)
    }
  }

  const handleCompileClick = (e: React.MouseEvent, pkg: SupportPackageWithSources) => {
    e.stopPropagation()
    if (pkg.sourceCount === 0) return
    setAnalyzingPackageId(pkg.id)
    void triggerAnalysis(pkg.id)
  }

  const handleDialogClose = () => {
    setSettingsPackage(null)
    setShowCreateDialog(false)
    onCreateDialogClose?.()
  }

  const handlePackageSaved = async () => {
    const pkgs = await fetchPackages()
    // In selection mode, auto-select the first package if none is selected
    if (onPackageSelect && !activePackageId && pkgs.length > 0) {
      onPackageSelect(pkgs[0].id)
    }
    onPackagesChange?.()
    handleDialogClose()
  }

  const handleContentSaved = () => {
    void fetchPackages()
    onPackagesChange?.()
  }

  const handlePackageDeleted = () => {
    void fetchPackages()
    onPackagesChange?.()
    handleDialogClose()
    // Close expanded view if deleted package was expanded
    if (settingsPackage && expandedPackageId === settingsPackage.id) {
      setExpandedPackageId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-[4px] border-2 border-[color:var(--accent-danger)] bg-[color:var(--accent-danger)]/10 p-4 text-sm text-[color:var(--accent-danger)]">
        {error}
      </div>
    )
  }

  const isSelectionMode = !!onPackageSelect

  return (
    <div className="space-y-3">
      {!isSelectionMode && (
        <div className="flex items-center justify-between">
          <Heading as="h3" size="subsection">
            Available Packages
          </Heading>
          <Button
            variant="secondary"
            size="md"
            onClick={() => onCreatePackage ? onCreatePackage() : setShowCreateDialog(true)}
            disabled={!hasResources}
          >
            Create Package
          </Button>
        </div>
      )}

      {packages.length === 0 && !hasResources ? (
        <div className="rounded-[4px] border-2 border-dashed border-[color:var(--border-subtle)] p-8 text-center opacity-60">
          <p className="text-sm text-[color:var(--text-secondary)]">
            Connect resources first to create knowledge packages.
          </p>
        </div>
      ) : packages.length === 0 ? (
        <div className="rounded-[4px] border-2 border-dashed border-[color:var(--border-subtle)] p-8 text-center">
          <p className="text-sm text-[color:var(--text-secondary)] mb-4">
            No knowledge packages yet. Create a package to organize your knowledge sources.
          </p>
          <Button variant="primary" size="sm" onClick={() => onCreatePackage ? onCreatePackage() : setShowCreateDialog(true)}>
            Create First Package
          </Button>
        </div>
      ) : (
        <div className={`space-y-2 ${isSelectionMode ? 'max-h-[400px] overflow-y-auto' : ''}`}>
          {sortedPackages.map((pkg) => {
              const isExpanded = expandedPackageId === pkg.id
              const isAnalyzingThis = analyzingPackageId === pkg.id && isAnalyzing

              return (
                <PackageListItem
                  key={pkg.id}
                  projectId={projectId}
                  pkg={pkg}
                  isExpanded={isExpanded}
                  isActive={pkg.id === activePackageId}
                  isAnalyzing={isAnalyzingThis}
                  analysisEvents={analysisEvents}
                  onToggleExpand={() => handleToggleExpand(pkg)}
                  onSettingsClick={(e) => handleSettingsClick(e, pkg)}
                  onCompileClick={(e) => handleCompileClick(e, pkg)}
                  onCancelAnalysis={cancelAnalysis}
                  onContentSaved={handleContentSaved}
                  onSelect={isSelectionMode ? () => onPackageSelect(pkg.id) : undefined}
                />
              )
            })}
        </div>
      )}

      {/* Create Package Dialog - only render when not delegated to parent */}
      {!onCreatePackage && showCreateDialog && (
        <PackageDialog
          projectId={projectId}
          open={showCreateDialog}
          onClose={handleDialogClose}
          onSaved={handlePackageSaved}
        />
      )}

      {/* Settings Dialog - only render when not delegated to parent */}
      {!onEditPackage && settingsPackage && (
        <PackageDialog
          projectId={projectId}
          package={settingsPackage}
          open={!!settingsPackage}
          onClose={handleDialogClose}
          onSaved={handlePackageSaved}
          onDeleted={handlePackageDeleted}
        />
      )}
    </div>
  )
}
