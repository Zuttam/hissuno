'use client'

import Link from 'next/link'
import { Button, IconButton } from '@/components/ui'
import { SettingsIcon, ChevronRightIcon, RefreshIcon, CheckIcon } from '@/components/ui/icons'
import { AnalysisProgressBar, type AnalysisEvent } from './analysis-progress-bar'
import { PackageContentTabs } from './package-content-tabs'
import { formatRelativeTime } from '@/lib/utils/format-time'
import type { KnowledgePackageWithSources } from '@/lib/knowledge/types'

interface PackageListItemProps {
  projectId: string
  pkg: KnowledgePackageWithSources
  isExpanded: boolean
  isActive: boolean
  isAnalyzing: boolean
  analysisEvents: AnalysisEvent[]
  onToggleExpand: () => void
  onSettingsClick: (e: React.MouseEvent) => void
  onCompileClick: (e: React.MouseEvent) => void
  onCancelAnalysis: () => void
  onContentSaved: () => void
  onSelect?: () => void
}

export function PackageListItem({
  projectId,
  pkg,
  isExpanded,
  isActive,
  isAnalyzing,
  analysisEvents,
  onToggleExpand,
  onSettingsClick,
  onCompileClick,
  onCancelAnalysis,
  onContentSaved,
  onSelect,
}: PackageListItemProps) {
  return (
    <div className={`rounded-[4px] border-2 bg-[color:var(--surface)] overflow-hidden ${onSelect && isActive ? 'border-[color:var(--accent-selected)]' : 'border-[color:var(--border-subtle)]'}`}>
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
                {pkg.sourceCount} source{pkg.sourceCount !== 1 ? 's' : ''}
                {pkg.compiled_at ? ` • Compiled ${formatRelativeTime(pkg.compiled_at)}` : ` • Last built: ${formatRelativeTime(pkg.lastAnalyzedAt)}`}
                {isActive && !onSelect && (
                  <>
                    {' '}
                    • In use:{' '}
                    <Link
                      href={`/projects/${projectId}/agents`}
                      className="text-[color:var(--accent-selected)] hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Support Specialist
                    </Link>
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Selection indicator */}
            {onSelect && isActive && (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--accent-selected)] text-white">
                <CheckIcon className="h-3.5 w-3.5" />
              </span>
            )}
            {onSelect && !isActive && (
              <IconButton
                variant="ghost"
                size="sm"
                aria-label="Select this package"
                title="Select this package"
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect()
                }}
              >
                <CheckIcon className="h-4 w-4" />
              </IconButton>
            )}
            {/* Compile package button */}
            <IconButton
              variant="ghost"
              size="sm"
              aria-label={pkg.sourceCount === 0 ? 'Add sources to build' : 'Compile package'}
              title={pkg.sourceCount === 0 ? 'Add sources to build' : 'Compile package'}
              onClick={onCompileClick}
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
        <div className="border-t border-[color:var(--border-subtle)] px-4 py-3">
          <PackageContentTabs
            projectId={projectId}
            packageId={pkg.id}
            faqContent={pkg.faq_content}
            howtoContent={pkg.howto_content}
            featureDocsContent={pkg.feature_docs_content}
            troubleshootingContent={pkg.troubleshooting_content}
            onContentSaved={onContentSaved}
          />
        </div>
      )}
    </div>
  )
}
