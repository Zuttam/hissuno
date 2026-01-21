'use client'

import { useState, useCallback, useEffect, type ChangeEvent } from 'react'
import { EditDialog } from './edit-dialog'
import { FormField, Input, Select, Button, Textarea, Alert } from '@/components/ui'
import type { KnowledgeSourceType } from '@/lib/knowledge/types'

interface KnowledgeSource {
  id: string
  type: KnowledgeSourceType
  url: string | null
  content: string | null
  analysis_scope: string | null
  status: string
  enabled: boolean
  source_code?: {
    repository_url: string
    repository_branch: string
  } | null
}

interface GitHubStatus {
  connected: boolean
  installationId?: number
}

interface Repo {
  id: number
  fullName: string
  defaultBranch: string
}

interface KnowledgeSourcesDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  onSaved?: () => void
}

const SOURCE_TYPE_CONFIG: Record<Exclude<KnowledgeSourceType, 'codebase'>, { icon: string; name: string; placeholder: string }> = {
  website: { icon: '🌐', name: 'Website', placeholder: 'https://example.com' },
  docs_portal: { icon: '📚', name: 'Documentation', placeholder: 'https://docs.example.com' },
  uploaded_doc: { icon: '📄', name: 'Documents', placeholder: '' },
  raw_text: { icon: '📝', name: 'Custom Text', placeholder: 'Enter custom content...' },
}

export function KnowledgeSourcesDialog({
  open,
  onClose,
  projectId,
  onSaved,
}: KnowledgeSourcesDialogProps) {
  const [sources, setSources] = useState<KnowledgeSource[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // GitHub state
  const [githubStatus, setGithubStatus] = useState<GitHubStatus>({ connected: false })
  const [repos, setRepos] = useState<Repo[]>([])
  const [branches, setBranches] = useState<string[]>([])
  const [isLoadingRepos, setIsLoadingRepos] = useState(false)
  const [isLoadingBranches, setIsLoadingBranches] = useState(false)

  // Codebase config
  const [selectedRepo, setSelectedRepo] = useState<string>('')
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [analysisScope, setAnalysisScope] = useState<string>('')

  // New source input
  const [addingType, setAddingType] = useState<Exclude<KnowledgeSourceType, 'codebase'> | null>(null)
  const [newSourceInput, setNewSourceInput] = useState('')
  const [newSourceFile, setNewSourceFile] = useState<File | null>(null)

  // Fetch knowledge sources and GitHub status
  useEffect(() => {
    if (!open) return

    const fetchData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const [sourcesRes, githubRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/settings/knowledge-sources`),
          fetch(`/api/integrations/github?projectId=${projectId}`),
        ])

        if (sourcesRes.ok) {
          const data = await sourcesRes.json()
          setSources(data.sources || [])

          // Set codebase config from existing source
          const codebaseSource = data.sources?.find((s: KnowledgeSource) => s.type === 'codebase')
          if (codebaseSource?.source_code) {
            const url = codebaseSource.source_code.repository_url
            const match = url.match(/github\.com\/([^/]+\/[^/]+)/)
            if (match) {
              setSelectedRepo(match[1])
            }
            setSelectedBranch(codebaseSource.source_code.repository_branch || '')
            setAnalysisScope(codebaseSource.analysis_scope || '')
          }
        }

        if (githubRes.ok) {
          const data = await githubRes.json()
          setGithubStatus({
            connected: data.connected,
            installationId: data.installationId,
          })
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load knowledge sources')
      } finally {
        setIsLoading(false)
      }
    }

    void fetchData()
  }, [open, projectId])

  // Fetch repos when GitHub is connected
  useEffect(() => {
    if (!open || !githubStatus.connected) return

    const fetchRepos = async () => {
      setIsLoadingRepos(true)
      try {
        const res = await fetch(`/api/integrations/github/repos?projectId=${projectId}`)
        if (res.ok) {
          const data = await res.json()
          setRepos(data.repos || [])
        }
      } catch {
        // Silent fail
      } finally {
        setIsLoadingRepos(false)
      }
    }

    void fetchRepos()
  }, [open, githubStatus.connected, projectId])

  // Fetch branches when repo changes
  useEffect(() => {
    if (!selectedRepo || !open) return

    const fetchBranches = async () => {
      setIsLoadingBranches(true)
      try {
        const [owner, repo] = selectedRepo.split('/')
        const res = await fetch(`/api/integrations/github/repos/${owner}/${repo}/branches?projectId=${projectId}`)
        if (res.ok) {
          const data = await res.json()
          setBranches(data.branches?.map((b: { name: string }) => b.name) || [])
        }
      } catch {
        // Silent fail
      } finally {
        setIsLoadingBranches(false)
      }
    }

    void fetchBranches()
  }, [selectedRepo, projectId, open])

  const handleRepoChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    const fullName = e.target.value
    setSelectedRepo(fullName)
    const repo = repos.find(r => r.fullName === fullName)
    if (repo) {
      setSelectedBranch(repo.defaultBranch)
    }
  }, [repos])

  const handleBranchChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    setSelectedBranch(e.target.value)
  }, [])

  const handleAddSource = useCallback(async () => {
    if (!addingType) return

    setIsSaving(true)
    setError(null)

    try {
      let body: FormData | string
      const headers: Record<string, string> = {}

      if (addingType === 'uploaded_doc' && newSourceFile) {
        const formData = new FormData()
        formData.append('type', addingType)
        formData.append('file', newSourceFile)
        body = formData
      } else {
        headers['Content-Type'] = 'application/json'
        body = JSON.stringify({
          type: addingType,
          url: addingType === 'website' || addingType === 'docs_portal' ? newSourceInput : undefined,
          content: addingType === 'raw_text' ? newSourceInput : undefined,
        })
      }

      const res = await fetch(`/api/projects/${projectId}/settings/knowledge-sources`, {
        method: 'POST',
        headers,
        body,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to add source')
      }

      const data = await res.json()
      setSources(prev => [...prev, data.source])
      setAddingType(null)
      setNewSourceInput('')
      setNewSourceFile(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add source')
    } finally {
      setIsSaving(false)
    }
  }, [addingType, newSourceInput, newSourceFile, projectId])

  const handleRemoveSource = useCallback(async (sourceId: string) => {
    if (!confirm('Are you sure you want to remove this source?')) return

    setIsSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/projects/${projectId}/settings/knowledge-sources?sourceId=${sourceId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to remove source')
      }

      setSources(prev => prev.filter(s => s.id !== sourceId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove source')
    } finally {
      setIsSaving(false)
    }
  }, [projectId])

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)

    try {
      // Save codebase if configured
      if (selectedRepo && selectedBranch) {
        const existingCodebase = sources.find(s => s.type === 'codebase')

        // Check if codebase config changed
        const currentRepoUrl = existingCodebase?.source_code?.repository_url
        const currentBranch = existingCodebase?.source_code?.repository_branch
        const currentScope = existingCodebase?.analysis_scope

        const newRepoUrl = `https://github.com/${selectedRepo}`
        const repoChanged = currentRepoUrl !== newRepoUrl
        const branchChanged = currentBranch !== selectedBranch
        const scopeChanged = currentScope !== (analysisScope || null)

        if (repoChanged || branchChanged || !existingCodebase) {
          // Create or replace codebase
          const res = await fetch(`/api/projects/${projectId}/settings/knowledge-sources`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'codebase',
              repositoryUrl: newRepoUrl,
              repositoryBranch: selectedBranch,
              analysis_scope: analysisScope || null,
            }),
          })

          if (!res.ok) {
            const data = await res.json()
            throw new Error(data.error || 'Failed to save codebase')
          }
        } else if (scopeChanged && existingCodebase) {
          // Just update analysis_scope
          const res = await fetch(`/api/projects/${projectId}/settings/knowledge-sources?sourceId=${existingCodebase.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ analysis_scope: analysisScope || null }),
          })

          if (!res.ok) {
            const data = await res.json()
            throw new Error(data.error || 'Failed to update codebase')
          }
        }
      }

      onSaved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  const getSourceDisplay = (source: KnowledgeSource) => {
    if (source.url) return source.url
    if (source.content) return source.content.slice(0, 60) + (source.content.length > 60 ? '...' : '')
    return 'Unknown'
  }

  const nonCodebaseSources = sources.filter(s => s.type !== 'codebase')

  return (
    <EditDialog
      open={open}
      onClose={onClose}
      onSave={handleSave}
      title="Knowledge Sources"
      isSaving={isSaving}
      error={error}
      size="xl"
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-[color:var(--foreground)] border-t-transparent" />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* GitHub Codebase Section */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-[color:var(--text-secondary)] uppercase tracking-wide">
              Codebase
            </h4>

            {!githubStatus.connected ? (
              <Alert variant="info">
                Connect GitHub to add your codebase as a knowledge source.
                <Button
                  variant="primary"
                  size="sm"
                  className="ml-4"
                  onClick={() => {
                    const nextUrl = `/projects/${projectId}/knowledge`
                    window.open(`/api/integrations/github/connect?projectId=${projectId}&nextUrl=${encodeURIComponent(nextUrl)}`, '_blank')
                  }}
                >
                  Connect GitHub
                </Button>
              </Alert>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Repository">
                    <Select
                      value={selectedRepo}
                      onChange={handleRepoChange}
                      disabled={isLoadingRepos}
                    >
                      <option value="">
                        {isLoadingRepos ? 'Loading...' : 'Select repository'}
                      </option>
                      {repos.map(repo => (
                        <option key={repo.id} value={repo.fullName}>
                          {repo.fullName}
                        </option>
                      ))}
                    </Select>
                  </FormField>

                  <FormField label="Branch">
                    <Select
                      value={selectedBranch}
                      onChange={handleBranchChange}
                      disabled={isLoadingBranches || !selectedRepo}
                    >
                      <option value="">
                        {isLoadingBranches ? 'Loading...' : 'Select branch'}
                      </option>
                      {branches.map(branch => (
                        <option key={branch} value={branch}>
                          {branch}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </div>

                {selectedRepo && (
                  <FormField
                    label="Analysis Scope (optional)"
                    description="For monorepos, specify a subdirectory path"
                  >
                    <Input
                      value={analysisScope}
                      onChange={(e) => setAnalysisScope(e.target.value)}
                      placeholder="e.g., packages/core"
                    />
                  </FormField>
                )}
              </div>
            )}
          </div>

          {/* Other Sources Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-[color:var(--text-secondary)] uppercase tracking-wide">
                Additional Sources
              </h4>
              {!addingType && (
                <div className="flex gap-2">
                  {(Object.keys(SOURCE_TYPE_CONFIG) as Exclude<KnowledgeSourceType, 'codebase'>[]).map(type => (
                    <Button
                      key={type}
                      variant="ghost"
                      size="sm"
                      onClick={() => setAddingType(type)}
                    >
                      {SOURCE_TYPE_CONFIG[type].icon} Add {SOURCE_TYPE_CONFIG[type].name}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {/* Add new source form */}
            {addingType && (
              <div className="p-4 border border-[color:var(--border-subtle)] rounded-[4px] bg-[color:var(--surface)] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {SOURCE_TYPE_CONFIG[addingType].icon} Add {SOURCE_TYPE_CONFIG[addingType].name}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => {
                    setAddingType(null)
                    setNewSourceInput('')
                    setNewSourceFile(null)
                  }}>
                    Cancel
                  </Button>
                </div>

                {addingType === 'uploaded_doc' ? (
                  <input
                    type="file"
                    accept=".pdf,.txt,.md,.doc,.docx"
                    onChange={(e) => setNewSourceFile(e.target.files?.[0] || null)}
                    className="text-sm"
                  />
                ) : addingType === 'raw_text' ? (
                  <Textarea
                    value={newSourceInput}
                    onChange={(e) => setNewSourceInput(e.target.value)}
                    placeholder={SOURCE_TYPE_CONFIG[addingType].placeholder}
                    rows={3}
                  />
                ) : (
                  <Input
                    value={newSourceInput}
                    onChange={(e) => setNewSourceInput(e.target.value)}
                    placeholder={SOURCE_TYPE_CONFIG[addingType].placeholder}
                  />
                )}

                <Button
                  size="sm"
                  onClick={handleAddSource}
                  disabled={
                    isSaving ||
                    (addingType === 'uploaded_doc' ? !newSourceFile : !newSourceInput.trim())
                  }
                  loading={isSaving}
                >
                  Add
                </Button>
              </div>
            )}

            {/* Existing sources list */}
            {nonCodebaseSources.length > 0 ? (
              <div className="space-y-2">
                {nonCodebaseSources.map(source => (
                  <div
                    key={source.id}
                    className="flex items-center justify-between p-3 border border-[color:var(--border-subtle)] rounded-[4px] bg-[color:var(--surface)]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span>{SOURCE_TYPE_CONFIG[source.type as Exclude<KnowledgeSourceType, 'codebase'>]?.icon || '📦'}</span>
                      <span className="text-sm text-[color:var(--foreground)] truncate">
                        {getSourceDisplay(source)}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveSource(source.id)}
                      disabled={isSaving}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[color:var(--text-tertiary)]">
                No additional sources configured. Add websites, documentation, or custom text to enhance your agent.
              </p>
            )}
          </div>
        </div>
      )}
    </EditDialog>
  )
}
