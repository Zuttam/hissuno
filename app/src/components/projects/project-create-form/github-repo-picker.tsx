'use client'

import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, FormField, Select, Spinner } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'

export type GitHubRepoSelection = {
  owner: string
  name: string
  fullName: string
  defaultBranch: string
}

export type GitHubRepoPickerProps = {
  selectedRepo: GitHubRepoSelection | null
  selectedBranch: string | null
  onRepoChange: (repo: GitHubRepoSelection | null) => void
  onBranchChange: (branch: string | null) => void
  hasGitHubIntegration: boolean
  onConnectGitHub: () => void
  isConnecting?: boolean
}

type RepoOption = {
  id: number
  name: string
  fullName: string
  owner: string
  private: boolean
  defaultBranch: string
  description: string | null
}

type BranchOption = {
  name: string
  sha: string
  protected: boolean
}

export function GitHubRepoPicker({
  selectedRepo,
  selectedBranch,
  onRepoChange,
  onBranchChange,
  hasGitHubIntegration,
  onConnectGitHub,
  isConnecting = false,
}: GitHubRepoPickerProps) {
  const [repos, setRepos] = useState<RepoOption[]>([])
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [isLoadingRepos, setIsLoadingRepos] = useState(false)
  const [isLoadingBranches, setIsLoadingBranches] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch repos when integration is connected
  const fetchRepos = useCallback(async () => {
    if (!hasGitHubIntegration) return

    setIsLoadingRepos(true)
    setError(null)

    try {
      const response = await fetch('/api/integrations/github/repos')
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch repositories')
      }
      const data = await response.json()
      setRepos(data.repos || [])
    } catch (err) {
      console.error('Failed to fetch repos:', err)
      setError(err instanceof Error ? err.message : 'Failed to load repositories')
    } finally {
      setIsLoadingRepos(false)
    }
  }, [hasGitHubIntegration])

  useEffect(() => {
    void fetchRepos()
  }, [fetchRepos])

  // Fetch branches when a repo is selected
  const fetchBranches = useCallback(async (owner: string, repo: string) => {
    setIsLoadingBranches(true)
    setError(null)

    try {
      const response = await fetch(`/api/integrations/github/repos/${owner}/${repo}/branches`)
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch branches')
      }
      const data = await response.json()
      setBranches(data.branches || [])
    } catch (err) {
      console.error('Failed to fetch branches:', err)
      setError(err instanceof Error ? err.message : 'Failed to load branches')
    } finally {
      setIsLoadingBranches(false)
    }
  }, [])

  useEffect(() => {
    if (selectedRepo) {
      void fetchBranches(selectedRepo.owner, selectedRepo.name)
    } else {
      setBranches([])
    }
  }, [selectedRepo, fetchBranches])

  const handleRepoChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const fullName = event.target.value
    if (!fullName) {
      onRepoChange(null)
      onBranchChange(null)
      return
    }

    const repo = repos.find((r) => r.fullName === fullName)
    if (repo) {
      onRepoChange({
        owner: repo.owner,
        name: repo.name,
        fullName: repo.fullName,
        defaultBranch: repo.defaultBranch,
      })
      // Auto-select default branch
      onBranchChange(repo.defaultBranch)
    }
  }

  const handleBranchChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const branch = event.target.value || null
    onBranchChange(branch)
  }

  // Show connect button if not connected
  if (!hasGitHubIntegration) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border-2 border-dashed border-[--border-subtle] bg-[--surface] p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 dark:bg-white">
            <GitHubIcon className="h-6 w-6 text-white dark:text-slate-900" />
          </div>
          <p className="mb-1 font-mono text-sm font-semibold text-[--foreground]">
            Connect GitHub
          </p>
          <p className="mb-4 text-sm text-[--text-secondary]">
            Link your GitHub account to import repositories directly.
          </p>
          <Button
            type="button"
            onClick={onConnectGitHub}
            disabled={isConnecting}
          >
            {isConnecting ? 'Connecting…' : 'Connect GitHub'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <FormField label="Repository">
        {isLoadingRepos ? (
          <div className="flex items-center gap-2 py-2">
            <Spinner size="sm" />
            <span className="text-sm text-[--text-secondary]">Loading repositories…</span>
          </div>
        ) : (
          <Select
            value={selectedRepo?.fullName || ''}
            onChange={handleRepoChange}
          >
            <option value="">Select a repository</option>
            {repos.map((repo) => (
              <option key={repo.id} value={repo.fullName}>
                {repo.fullName} {repo.private ? '🔒' : ''}
              </option>
            ))}
          </Select>
        )}
      </FormField>

      {selectedRepo && (
        <FormField label="Branch">
          {isLoadingBranches ? (
            <div className="flex items-center gap-2 py-2">
              <Spinner size="sm" />
              <span className="text-sm text-[--text-secondary]">Loading branches…</span>
            </div>
          ) : (
            <Select
              value={selectedBranch || ''}
              onChange={handleBranchChange}
            >
              <option value="">Select a branch</option>
              {branches.map((branch) => (
                <option key={branch.name} value={branch.name}>
                  {branch.name} {branch.protected ? '🛡️' : ''}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      )}

      {selectedRepo && selectedBranch && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-900/20">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
            ✓ Repository configured
          </p>
          <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
            {selectedRepo.fullName} @ {selectedBranch}
          </p>
        </div>
      )}

      {error && <Alert variant="danger">{error}</Alert>}
    </div>
  )
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  )
}
