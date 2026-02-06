'use client'

import { useState, useCallback, useEffect, useRef, type ChangeEvent } from 'react'
import Image from 'next/image'
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

type AddableSourceType = KnowledgeSourceType

const SOURCE_TYPE_CONFIG: Record<AddableSourceType, { icon: React.ReactNode; name: string; placeholder: string }> = {
  codebase: {
    icon: <Image src="/logos/github.svg" alt="GitHub" width={16} height={16} />,
    name: 'Codebase',
    placeholder: '',
  },
  website: { icon: <span>🌐</span>, name: 'Website', placeholder: 'https://example.com' },
  docs_portal: { icon: <span>📚</span>, name: 'Documentation', placeholder: 'https://docs.example.com' },
  uploaded_doc: { icon: <span>📄</span>, name: 'Documents', placeholder: '' },
  raw_text: { icon: <span>📝</span>, name: 'Custom Text', placeholder: 'Enter custom content...' },
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

  // Codebase config (shared for add + edit codebase)
  const [selectedRepo, setSelectedRepo] = useState<string>('')
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [analysisScope, setAnalysisScope] = useState<string>('')

  // New source input (add mode)
  const [addingType, setAddingType] = useState<AddableSourceType | null>(null)
  const [newSourceInput, setNewSourceInput] = useState('')
  const [newSourceFile, setNewSourceFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Edit mode for existing sources
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null)
  const [editUrl, setEditUrl] = useState('')
  const [editContent, setEditContent] = useState('')

  const hasCodebaseSource = sources.some(s => s.type === 'codebase')

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

  // Reset editing state when dialog closes
  useEffect(() => {
    if (!open) {
      setEditingSourceId(null)
      setAddingType(null)
    }
  }, [open])

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

  // --- Add source ---

  const handleAddSource = useCallback(async () => {
    if (!addingType) return

    setIsSaving(true)
    setError(null)

    try {
      if (addingType === 'codebase') {
        if (!selectedRepo || !selectedBranch) return

        const res = await fetch(`/api/projects/${projectId}/settings/knowledge-sources`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'codebase',
            repositoryUrl: `https://github.com/${selectedRepo}`,
            repositoryBranch: selectedBranch,
            analysis_scope: analysisScope || null,
          }),
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to add codebase')
        }

        const data = await res.json()
        setSources(prev => [...prev.filter(s => s.type !== 'codebase'), data.source])
        cancelAdding()
        return
      }

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
      cancelAdding()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add source')
    } finally {
      setIsSaving(false)
    }
  }, [addingType, newSourceInput, newSourceFile, projectId, selectedRepo, selectedBranch, analysisScope])

  // --- Edit source ---

  const openEditSource = useCallback((source: KnowledgeSource) => {
    // Close add mode if open
    setAddingType(null)
    setNewSourceInput('')
    setNewSourceFile(null)

    setEditingSourceId(source.id)

    if (source.type === 'codebase' && source.source_code) {
      const url = source.source_code.repository_url
      const match = url.match(/github\.com\/([^/]+\/[^/]+)/)
      setSelectedRepo(match ? match[1] : '')
      setSelectedBranch(source.source_code.repository_branch || '')
      setAnalysisScope(source.analysis_scope || '')
    } else if (source.type === 'website' || source.type === 'docs_portal') {
      setEditUrl(source.url || '')
    } else if (source.type === 'raw_text') {
      setEditContent(source.content || '')
    }
  }, [])

  const cancelEditing = useCallback(() => {
    setEditingSourceId(null)
    setEditUrl('')
    setEditContent('')
    setSelectedRepo('')
    setSelectedBranch('')
    setAnalysisScope('')
  }, [])

  const handleSaveEdit = useCallback(async (source: KnowledgeSource) => {
    setIsSaving(true)
    setError(null)

    try {
      if (source.type === 'codebase') {
        if (!selectedRepo || !selectedBranch) return

        const existingUrl = source.source_code?.repository_url
        const existingBranch = source.source_code?.repository_branch
        const newRepoUrl = `https://github.com/${selectedRepo}`
        const repoChanged = existingUrl !== newRepoUrl
        const branchChanged = existingBranch !== selectedBranch
        const scopeChanged = source.analysis_scope !== (analysisScope || null)

        if (repoChanged || branchChanged) {
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

          const data = await res.json()
          setSources(prev => prev.map(s => s.id === source.id ? data.source : s.type === 'codebase' ? data.source : s))
        } else if (scopeChanged) {
          const res = await fetch(`/api/projects/${projectId}/settings/knowledge-sources?sourceId=${source.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ analysis_scope: analysisScope || null }),
          })

          if (!res.ok) {
            const data = await res.json()
            throw new Error(data.error || 'Failed to update codebase')
          }

          setSources(prev => prev.map(s => s.id === source.id ? { ...s, analysis_scope: analysisScope || null } : s))
        }
      } else if (source.type === 'website' || source.type === 'docs_portal') {
        if (editUrl !== source.url) {
          const res = await fetch(`/api/projects/${projectId}/settings/knowledge-sources?sourceId=${source.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: editUrl }),
          })

          if (!res.ok) {
            const data = await res.json()
            throw new Error(data.error || 'Failed to update source')
          }

          setSources(prev => prev.map(s => s.id === source.id ? { ...s, url: editUrl } : s))
        }
      } else if (source.type === 'raw_text') {
        if (editContent !== source.content) {
          const res = await fetch(`/api/projects/${projectId}/settings/knowledge-sources?sourceId=${source.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: editContent }),
          })

          if (!res.ok) {
            const data = await res.json()
            throw new Error(data.error || 'Failed to update source')
          }

          setSources(prev => prev.map(s => s.id === source.id ? { ...s, content: editContent } : s))
        }
      }

      cancelEditing()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes')
    } finally {
      setIsSaving(false)
    }
  }, [projectId, selectedRepo, selectedBranch, analysisScope, editUrl, editContent, cancelEditing])

  // --- Remove / Disconnect ---

  const handleRemoveSource = useCallback(async (source: KnowledgeSource) => {
    const label = source.type === 'codebase' ? 'disconnect this codebase' : 'remove this source'
    if (!confirm(`Are you sure you want to ${label}?`)) return

    setIsSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/projects/${projectId}/settings/knowledge-sources?sourceId=${source.id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to remove source')
      }

      setSources(prev => prev.filter(s => s.id !== source.id))
      if (editingSourceId === source.id) {
        cancelEditing()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove source')
    } finally {
      setIsSaving(false)
    }
  }, [projectId, editingSourceId, cancelEditing])

  const handleSave = async () => {
    onSaved?.()
  }

  const getSourceDisplay = (source: KnowledgeSource) => {
    if (source.type === 'codebase' && source.source_code) {
      const url = source.source_code.repository_url
      const match = url.match(/github\.com\/([^/]+\/[^/]+)/)
      const repoName = match ? match[1] : url
      const branch = source.source_code.repository_branch || 'main'
      return `${repoName} (${branch})`
    }
    if (source.url) return source.url
    if (source.content) return source.content.slice(0, 60) + (source.content.length > 60 ? '...' : '')
    if (source.type === 'uploaded_doc') return 'Uploaded document'
    return 'Unknown'
  }

  const getSourceIcon = (source: KnowledgeSource) => {
    const config = SOURCE_TYPE_CONFIG[source.type]
    return config?.icon ?? <span>📦</span>
  }

  const cancelAdding = () => {
    setAddingType(null)
    setNewSourceInput('')
    setNewSourceFile(null)
    setSelectedRepo('')
    setSelectedBranch('')
    setAnalysisScope('')
  }

  const startAdding = (type: AddableSourceType) => {
    // Close edit mode if open
    cancelEditing()
    setAddingType(type)
  }

  const isAddDisabled = () => {
    if (!addingType) return true
    if (addingType === 'codebase') return !selectedRepo || !selectedBranch
    if (addingType === 'uploaded_doc') return !newSourceFile
    return !newSourceInput.trim()
  }

  const isEditSaveDisabled = (source: KnowledgeSource) => {
    if (source.type === 'codebase') return !selectedRepo || !selectedBranch
    if (source.type === 'website' || source.type === 'docs_portal') return !editUrl.trim()
    if (source.type === 'raw_text') return !editContent.trim()
    return false
  }

  // --- Render helpers ---

  const renderEditForm = (source: KnowledgeSource) => {
    const isCodebase = source.type === 'codebase'
    const removeLabel = isCodebase ? 'Disconnect' : 'Remove'

    return (
      <div
        key={source.id}
        className="p-4 border border-[color:var(--border-subtle)] rounded-[4px] bg-[color:var(--surface)] space-y-3"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium flex items-center gap-1.5">
            {getSourceIcon(source)} {SOURCE_TYPE_CONFIG[source.type]?.name ?? source.type}
          </span>
          <Button variant="ghost" size="sm" onClick={cancelEditing}>
            Cancel
          </Button>
        </div>

        {isCodebase ? (
          <div className="space-y-3">
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
        ) : source.type === 'website' || source.type === 'docs_portal' ? (
          <FormField label="URL">
            <Input
              value={editUrl}
              onChange={(e) => setEditUrl(e.target.value)}
              placeholder={SOURCE_TYPE_CONFIG[source.type].placeholder}
            />
          </FormField>
        ) : source.type === 'raw_text' ? (
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            placeholder={SOURCE_TYPE_CONFIG[source.type].placeholder}
            rows={3}
          />
        ) : (
          <p className="text-sm text-[color:var(--text-secondary)]">
            {getSourceDisplay(source)}
          </p>
        )}

        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="text-[color:var(--accent-danger)] hover:text-[color:var(--accent-danger)]"
            onClick={() => handleRemoveSource(source)}
            disabled={isSaving}
          >
            {removeLabel}
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={cancelEditing}>
              Cancel
            </Button>
            {source.type !== 'uploaded_doc' && (
              <Button
                size="sm"
                onClick={() => handleSaveEdit(source)}
                disabled={isSaving || isEditSaveDisabled(source)}
                loading={isSaving}
              >
                Save
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

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
        <div className="flex flex-col gap-4">
          {/* Add buttons */}
          {!addingType && !editingSourceId && (
            <div className="flex flex-wrap gap-2">
              {githubStatus.connected && !hasCodebaseSource && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => startAdding('codebase')}
                >
                  <span className="flex items-center gap-1.5">
                    {SOURCE_TYPE_CONFIG.codebase.icon} Add Codebase
                  </span>
                </Button>
              )}
              {(Object.keys(SOURCE_TYPE_CONFIG) as AddableSourceType[])
                .filter(type => type !== 'codebase')
                .map(type => (
                  <Button
                    key={type}
                    variant="ghost"
                    size="sm"
                    onClick={() => startAdding(type)}
                  >
                    <span className="flex items-center gap-1.5">
                      {SOURCE_TYPE_CONFIG[type].icon} Add {SOURCE_TYPE_CONFIG[type].name}
                    </span>
                  </Button>
                ))}
            </div>
          )}

          {/* Add new source form */}
          {addingType && (
            <div className="p-4 border border-[color:var(--border-subtle)] rounded-[4px] bg-[color:var(--surface)] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-1.5">
                  {SOURCE_TYPE_CONFIG[addingType].icon} Add {SOURCE_TYPE_CONFIG[addingType].name}
                </span>
                <Button variant="ghost" size="sm" onClick={cancelAdding}>
                  Cancel
                </Button>
              </div>

              {addingType === 'codebase' ? (
                !githubStatus.connected ? (
                  <Alert variant="info">
                    Connect GitHub to add your codebase as a knowledge source.
                    <Button
                      variant="primary"
                      size="sm"
                      className="ml-4"
                      onClick={() => {
                        const nextUrl = `/projects/${projectId}/agents`
                        window.open(`/api/integrations/github/connect?projectId=${projectId}&nextUrl=${encodeURIComponent(nextUrl)}`, '_blank')
                      }}
                    >
                      Connect GitHub
                    </Button>
                  </Alert>
                ) : (
                  <div className="space-y-3">
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
                )
              ) : addingType === 'uploaded_doc' ? (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,.md,.doc,.docx"
                    onChange={(e) => setNewSourceFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <div
                    className="flex items-center gap-3 rounded-[4px] border-2 border-dashed border-[color:var(--border-subtle)] px-4 py-3 cursor-pointer hover:border-[color:var(--accent-selected)] transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        fileInputRef.current?.click()
                      }}
                    >
                      Choose file
                    </Button>
                    <span className="text-sm text-[color:var(--text-secondary)] truncate">
                      {newSourceFile ? newSourceFile.name : 'No file selected'}
                    </span>
                  </div>
                </>
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

              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={cancelAdding}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddSource}
                  disabled={isSaving || isAddDisabled()}
                  loading={isSaving}
                >
                  Add
                </Button>
              </div>
            </div>
          )}

          {/* Source list */}
          {sources.length > 0 ? (
            <div className="space-y-2">
              {sources.map(source =>
                editingSourceId === source.id ? (
                  renderEditForm(source)
                ) : (
                  <div
                    key={source.id}
                    className="flex items-center justify-between p-3 border border-[color:var(--border-subtle)] rounded-[4px] bg-[color:var(--surface)] cursor-pointer hover:border-[color:var(--accent-selected)] transition-colors"
                    onClick={() => openEditSource(source)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex items-center shrink-0">{getSourceIcon(source)}</span>
                      <span className="text-sm text-[color:var(--foreground)] truncate">
                        {getSourceDisplay(source)}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        openEditSource(source)
                      }}
                    >
                      Configure
                    </Button>
                  </div>
                )
              )}
            </div>
          ) : !addingType ? (
            <p className="text-sm text-[color:var(--text-tertiary)] py-4 text-center">
              No sources configured. Add a codebase, website, documentation, or custom text to enhance your agent.
            </p>
          ) : null}

          {/* Connect GitHub prompt (if not connected and no codebase) */}
          {!githubStatus.connected && !hasCodebaseSource && !addingType && !editingSourceId && (
            <Alert variant="info">
              Connect GitHub to add your codebase as a knowledge source.
              <Button
                variant="primary"
                size="sm"
                className="ml-4"
                onClick={() => {
                  const nextUrl = `/projects/${projectId}/agents`
                  window.open(`/api/integrations/github/connect?projectId=${projectId}&nextUrl=${encodeURIComponent(nextUrl)}`, '_blank')
                }}
              >
                Connect GitHub
              </Button>
            </Alert>
          )}
        </div>
      )}
    </EditDialog>
  )
}
