'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button, Spinner, Heading } from '@/components/ui'
import { PackageDialog } from './package-dialog'
import { PackageListItem } from './package-list-item'
import { usePackageAnalysis } from '@/hooks/use-package-analysis'
import { CATEGORIES, type CategoryContent } from './category-tabs'
import type { NamedPackageWithSources, KnowledgeCategory } from '@/lib/knowledge/types'

interface PackageListProps {
  projectId: string
  activePackageId: string | null
  onPackagesChange?: () => void
  hasResources?: boolean
}

export function PackageList({ projectId, activePackageId, onPackagesChange, hasResources = true }: PackageListProps) {
  const [packages, setPackages] = useState<NamedPackageWithSources[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [settingsPackage, setSettingsPackage] = useState<NamedPackageWithSources | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  // Inline expansion state
  const [expandedPackageId, setExpandedPackageId] = useState<string | null>(null)
  const [categoryContents, setCategoryContents] = useState<
    Record<string, Record<KnowledgeCategory, CategoryContent>>
  >({})
  const [activeCategories, setActiveCategories] = useState<Record<string, KnowledgeCategory>>({})
  const [editingCategory, setEditingCategory] = useState<{
    packageId: string
    category: KnowledgeCategory
  } | null>(null)
  const [editedContent, setEditedContent] = useState<string>('')
  const [isSavingContent, setIsSavingContent] = useState(false)
  const [analyzingPackageId, setAnalyzingPackageId] = useState<string | null>(null)

  // Analysis hook - use ref to access current state in callback
  const expandedPackageIdRef = useRef(expandedPackageId)
  const activeCategoriesRef = useRef(activeCategories)
  expandedPackageIdRef.current = expandedPackageId
  activeCategoriesRef.current = activeCategories

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
      const pkgId = analyzingPackageId
      // Refresh packages
      void fetchPackages()
      if (pkgId) {
        // Reset category contents to force reload
        setCategoryContents((prev) => {
          const updated = { ...prev }
          delete updated[pkgId]
          return updated
        })
        // Refetch if this package is expanded
        if (expandedPackageIdRef.current === pkgId) {
          const category = activeCategoriesRef.current[pkgId] ?? 'business'
          setTimeout(() => {
            void fetchCategoryContent(pkgId, category)
          }, 0)
        }
      }
      setAnalyzingPackageId(null)
      onPackagesChange?.()
    },
  })

  const fetchPackages = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/projects/${projectId}/knowledge/packages`)
      if (!response.ok) {
        throw new Error('Failed to load packages')
      }
      const data = await response.json()
      const pkgs = data.packages ?? []
      setPackages(pkgs)
      return pkgs as NamedPackageWithSources[]
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
    async (pkgs: NamedPackageWithSources[]) => {
      for (const pkg of pkgs) {
        try {
          const response = await fetch(
            `/api/projects/${projectId}/knowledge/packages/${pkg.id}/analyze`
          )
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

  useEffect(() => {
    const init = async () => {
      const pkgs = await fetchPackages()
      if (pkgs.length > 0) {
        void checkRunningAnalysis(pkgs)
      }
    }
    void init()
  }, [fetchPackages, checkRunningAnalysis])

  // Fetch category content for a specific package
  const fetchCategoryContent = useCallback(
    async (packageId: string, category: KnowledgeCategory) => {
      // Initialize active category if not set
      setActiveCategories((prev) => {
        if (prev[packageId]) return prev
        return { ...prev, [packageId]: 'business' }
      })

      // Set loading state, initializing package contents if needed
      setCategoryContents((prev) => {
        let pkgContents = prev[packageId]

        // Initialize if not exists
        if (!pkgContents) {
          const initial: Record<string, CategoryContent> = {}
          for (const cat of CATEGORIES) {
            initial[cat] = { content: null, isLoading: false, error: null }
          }
          pkgContents = initial as Record<KnowledgeCategory, CategoryContent>
        }

        // Skip if already loaded or loading
        if (pkgContents[category]?.content !== null || pkgContents[category]?.isLoading) {
          // Still need to return initialized state if it was new
          if (!prev[packageId]) {
            return { ...prev, [packageId]: pkgContents }
          }
          return prev
        }

        return {
          ...prev,
          [packageId]: {
            ...pkgContents,
            [category]: { ...pkgContents[category], isLoading: true, error: null },
          },
        }
      })

      try {
        const response = await fetch(
          `/api/projects/${projectId}/knowledge/packages/${packageId}/content/${category}`
        )
        if (!response.ok) throw new Error('Failed to load content')
        const data = await response.json()

        setCategoryContents((prev) => ({
          ...prev,
          [packageId]: {
            ...prev[packageId],
            [category]: {
              content: data.content,
              version: data.version,
              generatedAt: data.generatedAt,
              isLoading: false,
              error: null,
            },
          },
        }))
      } catch (err) {
        console.error(`[package-list] Failed to fetch ${category} content:`, err)
        setCategoryContents((prev) => ({
          ...prev,
          [packageId]: {
            ...prev[packageId],
            [category]: {
              ...prev[packageId]?.[category],
              isLoading: false,
              error: 'Failed to load content',
            },
          },
        }))
      }
    },
    [projectId]
  )

  // Effect to fetch content when a package is expanded
  useEffect(() => {
    if (expandedPackageId) {
      // Use ref to get current category without adding it as a dependency
      const category = activeCategoriesRef.current[expandedPackageId] ?? 'business'
      void fetchCategoryContent(expandedPackageId, category)
    }
  }, [expandedPackageId, fetchCategoryContent])

  // Handle package expansion toggle
  const handleToggleExpand = (pkg: NamedPackageWithSources) => {
    if (expandedPackageId === pkg.id) {
      setExpandedPackageId(null)
      setEditingCategory(null)
    } else {
      setExpandedPackageId(pkg.id)
      // Content fetch is handled by useEffect watching expandedPackageId
    }
  }

  // Handle category tab change
  const handleCategoryChange = (packageId: string, category: KnowledgeCategory) => {
    setActiveCategories((prev) => ({ ...prev, [packageId]: category }))
    setEditingCategory(null)
    void fetchCategoryContent(packageId, category)
  }

  // Start editing a category
  const handleStartEdit = (packageId: string, category: KnowledgeCategory) => {
    const content = categoryContents[packageId]?.[category]?.content ?? ''
    setEditedContent(content)
    setEditingCategory({ packageId, category })
  }

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingCategory(null)
    setEditedContent('')
  }

  // Handle content save
  const handleSaveContent = async () => {
    if (!editingCategory) return

    const { packageId, category } = editingCategory
    setIsSavingContent(true)

    try {
      const response = await fetch(
        `/api/projects/${projectId}/knowledge/packages/${packageId}/content/${category}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: editedContent }),
        }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error ?? 'Failed to save content')
      }

      const data = await response.json()

      // Update local state
      setCategoryContents((prev) => ({
        ...prev,
        [packageId]: {
          ...prev[packageId],
          [category]: {
            content: editedContent,
            version: data.version,
            generatedAt: new Date().toISOString(),
            isLoading: false,
            error: null,
          },
        },
      }))

      setEditingCategory(null)
      setEditedContent('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save content'
      setError(message)
    } finally {
      setIsSavingContent(false)
    }
  }

  const handleSettingsClick = (e: React.MouseEvent, pkg: NamedPackageWithSources) => {
    e.stopPropagation()
    setSettingsPackage(pkg)
  }

  const handleAnalyzeClick = (e: React.MouseEvent, pkg: NamedPackageWithSources) => {
    e.stopPropagation()
    if (pkg.sourceCount === 0) return
    // Close content view to prevent editing during analysis
    if (expandedPackageId === pkg.id) {
      setExpandedPackageId(null)
      setEditingCategory(null)
    }
    setAnalyzingPackageId(pkg.id)
    void triggerAnalysis(pkg.id)
  }

  const handleDialogClose = () => {
    setSettingsPackage(null)
    setShowCreateDialog(false)
  }

  const handlePackageSaved = () => {
    void fetchPackages()
    onPackagesChange?.()
    handleDialogClose()
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Heading as="h3" size="subsection">
          Knowledge Packages
        </Heading>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowCreateDialog(true)}
          disabled={!hasResources}
        >
          Create Package
        </Button>
      </div>

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
          <Button variant="primary" size="sm" onClick={() => setShowCreateDialog(true)}>
            Create First Package
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {packages.map((pkg) => {
            const isExpanded = expandedPackageId === pkg.id
            const activeCategory = activeCategories[pkg.id] ?? 'business'
            const pkgContents = categoryContents[pkg.id]
            const isAnalyzingThis = analyzingPackageId === pkg.id && isAnalyzing

            return (
              <PackageListItem
                key={pkg.id}
                projectId={projectId}
                pkg={pkg}
                isExpanded={isExpanded}
                isActive={pkg.id === activePackageId}
                isAnalyzing={isAnalyzingThis}
                activeCategory={activeCategory}
                categoryContents={pkgContents}
                editingCategory={
                  editingCategory?.packageId === pkg.id ? editingCategory : null
                }
                editedContent={editedContent}
                isSavingContent={isSavingContent}
                analysisEvents={analysisEvents}
                onToggleExpand={() => handleToggleExpand(pkg)}
                onSettingsClick={(e) => handleSettingsClick(e, pkg)}
                onAnalyzeClick={(e) => handleAnalyzeClick(e, pkg)}
                onCategoryChange={(category) => handleCategoryChange(pkg.id, category)}
                onStartEdit={(category) => handleStartEdit(pkg.id, category)}
                onCancelEdit={handleCancelEdit}
                onSaveContent={handleSaveContent}
                onEditedContentChange={setEditedContent}
                onCancelAnalysis={cancelAnalysis}
              />
            )
          })}
        </div>
      )}

      {/* Create Package Dialog */}
      {showCreateDialog && (
        <PackageDialog
          projectId={projectId}
          open={showCreateDialog}
          onClose={handleDialogClose}
          onSaved={handlePackageSaved}
        />
      )}

      {/* Settings Dialog */}
      {settingsPackage && (
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
