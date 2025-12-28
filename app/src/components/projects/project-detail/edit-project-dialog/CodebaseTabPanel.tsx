'use client'

import { useState, useRef } from 'react'
import type { ProjectWithCodebase } from '@/lib/projects/queries'
import { Alert, Button, FormField, Select, Spinner } from '@/components/ui'
import {
  GitHubRepoPicker,
  type GitHubRepoSelection,
} from '@/components/projects/project-create-form/github-repo-picker'

type BranchOption = {
  name: string
  sha: string
  protected: boolean
}

export type PendingSourceCode = {
  repositoryUrl: string
  repositoryBranch: string
}

interface CodebaseTabPanelProps {
  sourceCode: ProjectWithCodebase['source_code']
  isGitHubSource: boolean
  repoInfo: { owner: string; repo: string } | null
  repositoryBranch: string
  setRepositoryBranch: (value: string) => void
  branches: BranchOption[]
  isLoadingBranches: boolean
  // Props for connecting/changing codebase
  hasGitHubIntegration: boolean
  onConnectGitHub: () => void
  isConnectingGitHub?: boolean
  pendingSourceCode: PendingSourceCode | null
  onPendingSourceCodeChange: (pending: PendingSourceCode | null) => void
}

export function CodebaseTabPanel({
  sourceCode,
  isGitHubSource,
  repoInfo,
  repositoryBranch,
  setRepositoryBranch,
  branches,
  isLoadingBranches,
  hasGitHubIntegration,
  onConnectGitHub,
  isConnectingGitHub = false,
  pendingSourceCode,
  onPendingSourceCodeChange,
}: CodebaseTabPanelProps) {
  const [showChangeConfirmation, setShowChangeConfirmation] = useState(false)
  const [showRepoPicker, setShowRepoPicker] = useState(false)

  // State for GitHubRepoPicker
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepoSelection | null>(null)
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null)

  // Track the latest repo for when branch change is called immediately after repo change
  const latestRepoRef = useRef<GitHubRepoSelection | null>(null)

  const handleRepoChange = (repo: GitHubRepoSelection | null) => {
    setSelectedRepo(repo)
    latestRepoRef.current = repo
    if (!repo) {
      setSelectedBranch(null)
      onPendingSourceCodeChange(null)
    }
  }

  const handleBranchChange = (branch: string | null) => {
    setSelectedBranch(branch)
    // Use ref to get the latest repo value (handles async state updates)
    const repo = latestRepoRef.current
    if (repo && branch) {
      onPendingSourceCodeChange({
        repositoryUrl: `https://github.com/${repo.fullName}`,
        repositoryBranch: branch,
      })
    } else {
      onPendingSourceCodeChange(null)
    }
  }

  const handleConfirmChange = () => {
    setShowChangeConfirmation(false)
    setShowRepoPicker(true)
    // Reset selection when starting to change
    setSelectedRepo(null)
    setSelectedBranch(null)
    onPendingSourceCodeChange(null)
  }

  const handleCancelChange = () => {
    setShowRepoPicker(false)
    setSelectedRepo(null)
    setSelectedBranch(null)
    onPendingSourceCodeChange(null)
  }

  // No source code - show repo picker to connect
  if (!sourceCode) {
    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            No codebase connected. Connect a GitHub repository to enable codebase analysis.
          </p>
        </div>

        <GitHubRepoPicker
          selectedRepo={selectedRepo}
          selectedBranch={selectedBranch}
          onRepoChange={handleRepoChange}
          onBranchChange={handleBranchChange}
          hasGitHubIntegration={hasGitHubIntegration}
          onConnectGitHub={onConnectGitHub}
          isConnecting={isConnectingGitHub}
        />

        
      </div>
    )
  }

  // Has source code - show current info with option to change
  return (
    <div className="flex flex-col gap-10">
      {/* Source code info box */}
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

      {/* Show change confirmation dialog */}
      {showChangeConfirmation && (
        <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4 dark:border-amber-600 dark:bg-amber-900/30">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-3">
            Are you sure you want to change the repository?
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mb-4">
            This will delete all existing codebase analysis data. The new repository will need to be re-analyzed.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowChangeConfirmation(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={handleConfirmChange}
            >
              Yes, change repository
            </Button>
          </div>
        </div>
      )}

      {/* Show repo picker when changing */}
      {showRepoPicker && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Select new repository
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCancelChange}
            >
              Cancel
            </Button>
          </div>

          <GitHubRepoPicker
            selectedRepo={selectedRepo}
            selectedBranch={selectedBranch}
            onRepoChange={handleRepoChange}
            onBranchChange={handleBranchChange}
            hasGitHubIntegration={hasGitHubIntegration}
            onConnectGitHub={onConnectGitHub}
            isConnecting={isConnectingGitHub}
          />

          {pendingSourceCode && (
            <Alert variant="info">
              Click &quot;Save changes&quot; to connect the new repository.
            </Alert>
          )}
        </div>
      )}

      {/* Current repository info - show when not changing */}
      {isGitHubSource && repoInfo && !showRepoPicker && !showChangeConfirmation && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                Repository
              </p>
              <p className="text-sm text-slate-900 dark:text-slate-100 font-mono">
                {repoInfo.owner}/{repoInfo.repo}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowChangeConfirmation(true)}
            >
              Change Repository
            </Button>
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

    </div>
  )
}
