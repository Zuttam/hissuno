'use client'

import type { ProjectWithCodebase } from '@/lib/projects/queries'
import { FormField, Input, Select, Spinner } from '@/components/ui'

type BranchOption = {
  name: string
  sha: string
  protected: boolean
}

interface CodebaseTabPanelProps {
  sourceCode: ProjectWithCodebase['source_code']
  isGitHubSource: boolean
  repoInfo: { owner: string; repo: string } | null
  repositoryBranch: string
  setRepositoryBranch: (value: string) => void
  branches: BranchOption[]
  isLoadingBranches: boolean
  analysisScope: string
  setAnalysisScope: (value: string) => void
}

export function CodebaseTabPanel({
  sourceCode,
  isGitHubSource,
  repoInfo,
  repositoryBranch,
  setRepositoryBranch,
  branches,
  isLoadingBranches,
  analysisScope,
  setAnalysisScope,
}: CodebaseTabPanelProps) {
  if (!sourceCode) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No source code linked yet. Create a new project with a codebase to access these settings.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
        <div className="space-y-1 text-sm">
          <p className="font-semibold text-slate-700 dark:text-slate-100">Source Code</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Type: {sourceCode.kind ?? '—'}
          </p>
          {sourceCode.storage_uri && (
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              Storage: {sourceCode.storage_uri}
            </p>
          )}
        </div>
      </div>

      {isGitHubSource && repoInfo && (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wide">
              Repository
            </p>
            <p className="text-sm text-slate-900 dark:text-slate-100 font-mono">
              {repoInfo.owner}/{repoInfo.repo}
            </p>
          </div>

          <FormField label="Branch">
            {isLoadingBranches ? (
              <div className="flex items-center gap-2 py-2">
                <Spinner size="sm" />
                <span className="text-sm text-slate-500">Loading branches…</span>
              </div>
            ) : (
              <Select
                value={repositoryBranch}
                onChange={(e) => setRepositoryBranch(e.target.value)}
              >
                {branches.length === 0 && repositoryBranch && (
                  <option value={repositoryBranch}>{repositoryBranch}</option>
                )}
                {branches.map((branch) => (
                  <option key={branch.name} value={branch.name}>
                    {branch.name} {branch.protected ? '🛡️' : ''}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        </div>
      )}

      <FormField
        label="Analysis Scope"
        description="Limit analysis to a specific path (e.g., packages/my-app for monorepos)"
      >
        <Input
          type="text"
          value={analysisScope}
          onChange={(e) => setAnalysisScope(e.target.value)}
          placeholder="Leave empty to analyze entire codebase"
        />
      </FormField>
    </div>
  )
}
