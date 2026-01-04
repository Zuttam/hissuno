'use client'

import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { FormField, Input, Select, Button } from '@/components/ui'
import { ChannelRow } from '../sessions-step/channel-row'
import type { CodebaseConfig, GitHubIntegrationState } from '../types'

interface CodebaseSourceProps {
  codebase: CodebaseConfig
  github: GitHubIntegrationState
  repos: Array<{ id: number; fullName: string; defaultBranch: string }>
  branches: string[]
  isLoadingRepos: boolean
  isLoadingBranches: boolean
  onRepoChange: (e: ChangeEvent<HTMLSelectElement>) => void
  onBranchChange: (e: ChangeEvent<HTMLSelectElement>) => void
  onAnalysisScopeChange: (e: ChangeEvent<HTMLInputElement>) => void
  defaultExpanded?: boolean
}

export function CodebaseSource({
  codebase,
  github,
  repos,
  branches,
  isLoadingRepos,
  isLoadingBranches,
  onRepoChange,
  onBranchChange,
  onAnalysisScopeChange,
  defaultExpanded = false,
}: CodebaseSourceProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  return (
    <div>
      <ChannelRow
        icon="/github.svg"
        iconType="svg"
        name="GitHub Repository"
        description="Connect a GitHub repository to give your agent access to your codebase"
        isExpanded={isExpanded}
        isConnected={github.isConnected}
        isConnecting={github.isConnecting}
        onToggle={() => setIsExpanded(!isExpanded)}
        onConnect={github.onConnect}
      />

      {isExpanded && github.isConnected && (
        <div className="mt-4 mb-4 pl-8 flex flex-col gap-4">
          <FormField label="Repository">
            <Select
              value={codebase.fullName || ''}
              onChange={onRepoChange}
              disabled={isLoadingRepos}
            >
              <option value="">
                {isLoadingRepos ? 'Loading repositories...' : 'Select a repository'}
              </option>
              {repos.map((repo) => (
                <option key={repo.id} value={repo.fullName}>
                  {repo.fullName}
                </option>
              ))}
            </Select>
          </FormField>

          {codebase.fullName && (
            <>
              <FormField label="Branch">
                <Select
                  value={codebase.repositoryBranch || ''}
                  onChange={onBranchChange}
                  disabled={isLoadingBranches}
                >
                  <option value="">
                    {isLoadingBranches ? 'Loading branches...' : 'Select a branch'}
                  </option>
                  {branches.map((branch) => (
                    <option key={branch} value={branch}>
                      {branch}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField
                label="Analysis Scope (optional)"
                description="For monorepos, specify a subdirectory path to analyze."
              >
                <Input
                  value={codebase.analysisScope || ''}
                  onChange={onAnalysisScopeChange}
                  placeholder="e.g., packages/core"
                />
              </FormField>
            </>
          )}

          {github.onDisconnect && (
            <div className="flex justify-end mt-4">
              <Button
                variant="danger"
                size="sm"
                onClick={github.onDisconnect}
              >
                Disconnect
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
