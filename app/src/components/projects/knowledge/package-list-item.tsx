'use client'

import Link from 'next/link'
import { Button, IconButton } from '@/components/ui'
import { SettingsIcon, ChevronRightIcon, RefreshIcon } from '@/components/ui/icons'
import { AnalysisProgressBar, type AnalysisEvent } from './analysis-progress-bar'
import { CategoryTabs, type CategoryContent, CATEGORIES } from './category-tabs'
import { formatRelativeTime } from '@/lib/utils/format-time'
import type { NamedPackageWithSources, KnowledgeCategory } from '@/lib/knowledge/types'

interface PackageListItemProps {
  projectId: string
  pkg: NamedPackageWithSources
  isExpanded: boolean
  isActive: boolean
  isAnalyzing: boolean
  activeCategory: KnowledgeCategory
  categoryContents: Record<KnowledgeCategory, CategoryContent> | undefined
  editingCategory: { category: KnowledgeCategory } | null
  editedContent: string
  isSavingContent: boolean
  analysisEvents: AnalysisEvent[]
  onToggleExpand: () => void
  onSettingsClick: (e: React.MouseEvent) => void
  onAnalyzeClick: (e: React.MouseEvent) => void
  onCategoryChange: (category: KnowledgeCategory) => void
  onStartEdit: (category: KnowledgeCategory) => void
  onCancelEdit: () => void
  onSaveContent: () => void
  onEditedContentChange: (content: string) => void
  onCancelAnalysis: () => void
}

export function PackageListItem({
  projectId,
  pkg,
  isExpanded,
  isActive,
  isAnalyzing,
  activeCategory,
  categoryContents,
  editingCategory,
  editedContent,
  isSavingContent,
  analysisEvents,
  onToggleExpand,
  onSettingsClick,
  onAnalyzeClick,
  onCategoryChange,
  onStartEdit,
  onCancelEdit,
  onSaveContent,
  onEditedContentChange,
  onCancelAnalysis,
}: PackageListItemProps) {
  const isEditingThis = editingCategory?.category === activeCategory

  // Initialize category contents if needed for CategoryTabs
  const initializedCategoryContents = categoryContents ?? CATEGORIES.reduce(
    (acc, cat) => {
      acc[cat] = { content: null, isLoading: false, error: null }
      return acc
    },
    {} as Record<KnowledgeCategory, CategoryContent>
  )

  return (
    <div className="rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] overflow-hidden">
      {/* Header - clickable to expand */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggleExpand}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggleExpand()
          }
        }}
        className="w-full text-left px-4 py-3 transition hover:bg-[color:var(--surface-hover)] cursor-pointer"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg">📦</span>
            <div>
              <span className="font-mono font-semibold text-[color:var(--foreground)]">
                {pkg.name}
              </span>
              <p className="text-xs text-[color:var(--text-secondary)] mt-0.5">
                {pkg.sourceCount} source{pkg.sourceCount !== 1 ? 's' : ''} • Last analyzed:{' '}
                {formatRelativeTime(pkg.lastAnalyzedAt)}
                {isActive && (
                  <>
                    {' '}
                    • In use:{' '}
                    <Link
                      href={`/projects/${projectId}/agents`}
                      className="text-[color:var(--accent-selected)] hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Support Agent
                    </Link>
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Analyze icon button */}
            <IconButton
              variant="ghost"
              size="sm"
              aria-label={pkg.sourceCount === 0 ? 'Add sources to analyze' : 'Re-analyze sources'}
              title={pkg.sourceCount === 0 ? 'Add sources to analyze' : 'Re-analyze sources'}
              onClick={onAnalyzeClick}
              disabled={isAnalyzing || pkg.sourceCount === 0}
              loading={isAnalyzing}
            >
              <RefreshIcon />
            </IconButton>
            {/* Settings gear icon */}
            <IconButton
              variant="ghost"
              size="sm"
              aria-label="Edit package settings"
              title="Edit package settings"
              onClick={onSettingsClick}
            >
              <SettingsIcon />
            </IconButton>
            {/* Expand/collapse chevron */}
            <ChevronRightIcon
              className={`h-4 w-4 text-[color:var(--text-secondary)] transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            />
          </div>
        </div>
      </div>

      {/* Analysis Progress Bar */}
      {isAnalyzing && (
        <div className="px-4 pb-3 border-t border-[color:var(--border-subtle)]">
          <div className="pt-3 space-y-2">
            <AnalysisProgressBar events={analysisEvents} isProcessing={isAnalyzing} />
            <Button variant="ghost" size="sm" onClick={onCancelAnalysis}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Expanded content */}
      {isExpanded && (
        <div>
          <CategoryTabs
            packageId={pkg.id}
            activeCategory={activeCategory}
            categoryContents={initializedCategoryContents}
            categories={pkg.categories}
            isEditing={isEditingThis}
            editedContent={editedContent}
            isSavingContent={isSavingContent}
            onCategoryChange={onCategoryChange}
            onStartEdit={() => onStartEdit(activeCategory)}
            onCancelEdit={onCancelEdit}
            onSaveContent={onSaveContent}
            onEditedContentChange={onEditedContentChange}
          />
        </div>
      )}
    </div>
  )
}
