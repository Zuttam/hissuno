'use client'

import { useState, useCallback, useEffect, useRef, type ChangeEvent } from 'react'
import Image from 'next/image'
import { FormField, Input, Select, Button, Textarea, Alert, Spinner, Badge } from '@/components/ui'
import {
  listKnowledgeSources,
  addKnowledgeSource,
  updateKnowledgeSource,
  deleteKnowledgeSource,
} from '@/lib/api/knowledge'
import {
  fetchGithubStatus,
  fetchGithubRepos,
  fetchGithubBranches,
  fetchNotionStatus,
} from '@/lib/api/integrations'
import { NotionPickerDialog } from './notion-picker-dialog'
import type { KnowledgeSourceType } from '@/lib/knowledge/types'
import type { ProductScopeRecord } from '@/types/product-scope'

interface KnowledgeSource {
  id: string
  type: KnowledgeSourceType
  url: string | null
  content: string | null
  name?: string | null
  notion_page_id?: string | null
  analysis_scope: string | null
  status: string
  enabled: boolean
  analyzed_at: string | null
  product_scope_id: string | null
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
  notion: {
    icon: <Image src="/logos/notion.svg" alt="Notion" width={16} height={16} className="dark:invert" />,
    name: 'Notion',
    placeholder: '',
  },
}

// --- Reusable panel (used inline in settings page) ---

interface KnowledgeSourcesPanelProps {
  projectId: string
  onSourcesChange?: () => void
  productScopes?: ProductScopeRecord[]
  filterProductScopeId?: string | null
}

export function KnowledgeSourcesPanel({ projectId, onSourcesChange, productScopes, filterProductScopeId }: KnowledgeSourcesPanelProps) {
  const [sources, setSources] = useState<KnowledgeSource[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // GitHub state
  const [githubStatus, setGithubStatus] = useState<GitHubStatus>({ connected: false })
  const [repos, setRepos] = useState<Repo[]>([])
  const [branches, setBranches] = useState<string[]>([])
  const [isLoadingRepos, setIsLoadingRepos] = useState(false)
  const [isLoadingBranches, setIsLoadingBranches] = useState(false)

  // Notion state
  const [notionConnected, setNotionConnected] = useState(false)
  const [showNotionPicker, setShowNotionPicker] = useState(false)

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
  const [editProductScopeId, setEditProductScopeId] = useState<string>('')

  const hasCodebaseSource = sources.some(s => s.type === 'codebase')

  // Fetch knowledge sources and GitHub status
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const [sourcesData, githubRes, notionRes] = await Promise.all([
          listKnowledgeSources(projectId),
          fetchGithubStatus(projectId),
          fetchNotionStatus(projectId),
        ])

        setSources((sourcesData.sources || []) as unknown as KnowledgeSource[])

        if (githubRes.ok) {
          const data = await githubRes.json()
          setGithubStatus({
            connected: data.connected,
            installationId: data.installationId,
          })
        }

        if (notionRes.ok) {
          const data = await notionRes.json()
          setNotionConnected(data.connected)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load knowledge sources')
      } finally {
        setIsLoading(false)
      }
    }

    void fetchData()
  }, [projectId])

  // Fetch repos when GitHub is connected
  useEffect(() => {
    if (!githubStatus.connected) return

    const loadRepos = async () => {
      setIsLoadingRepos(true)
      try {
        const data = await fetchGithubRepos(projectId)
        setRepos(data.repos || [])
      } catch {
        // Silent fail
      } finally {
        setIsLoadingRepos(false)
      }
    }

    void loadRepos()
  }, [githubStatus.connected, projectId])

  // Fetch branches when repo changes
  useEffect(() => {
    if (!selectedRepo) return

    const loadBranches = async () => {
      setIsLoadingBranches(true)
      try {
        const [owner, repo] = selectedRepo.split('/')
        const data = await fetchGithubBranches(projectId, owner, repo)
        setBranches(data.branches?.map((b) => b.name) || [])
      } catch {
        // Silent fail
      } finally {
        setIsLoadingBranches(false)
      }
    }

    void loadBranches()
  }, [selectedRepo, projectId])

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

  const cancelAdding = () => {
    setAddingType(null)
    setNewSourceInput('')
    setNewSourceFile(null)
    setSelectedRepo('')
    setSelectedBranch('')
    setAnalysisScope('')
  }

  const startAdding = (type: AddableSourceType) => {
    if (type === 'notion') {
      if (!notionConnected) {
        setError('Connect Notion first from the Integrations page.')
        return
      }
      setShowNotionPicker(true)
      return
    }
    cancelEditing()
    setAddingType(type)
    setSuccess(null)
  }

  const cancelEditing = useCallback(() => {
    setEditingSourceId(null)
    setEditUrl('')
    setEditContent('')
    setEditProductScopeId('')
    setSelectedRepo('')
    setSelectedBranch('')
    setAnalysisScope('')
  }, [])

  // --- Add source ---

  const handleAddSource = useCallback(async () => {
    if (!addingType) return

    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      if (addingType === 'codebase') {
        if (!selectedRepo || !selectedBranch) return

        const { source } = await addKnowledgeSource(projectId, {
          type: 'codebase',
          repositoryUrl: `https://github.com/${selectedRepo}`,
          repositoryBranch: selectedBranch,
          analysis_scope: analysisScope || null,
        })

        setSources(prev => [...prev.filter(s => s.type !== 'codebase'), source as unknown as KnowledgeSource])
        setSuccess('Codebase connected successfully.')
        cancelAdding()
        onSourcesChange?.()
        return
      }

      let data: FormData | Record<string, unknown>

      if (addingType === 'uploaded_doc' && newSourceFile) {
        const formData = new FormData()
        formData.append('type', addingType)
        formData.append('file', newSourceFile)
        data = formData
      } else {
        data = {
          type: addingType,
          url: addingType === 'website' || addingType === 'docs_portal' ? newSourceInput : undefined,
          content: addingType === 'raw_text' ? newSourceInput : undefined,
        }
      }

      const { source } = await addKnowledgeSource(projectId, data)
      setSources(prev => [...prev, source as unknown as KnowledgeSource])
      setSuccess('Knowledge source added successfully.')
      cancelAdding()
      onSourcesChange?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add source')
    } finally {
      setIsSaving(false)
    }
  }, [addingType, newSourceInput, newSourceFile, projectId, selectedRepo, selectedBranch, analysisScope, onSourcesChange])

  // --- Edit source ---

  const openEditSource = useCallback((source: KnowledgeSource) => {
    setAddingType(null)
    setNewSourceInput('')
    setNewSourceFile(null)

    setEditingSourceId(source.id)
    setEditProductScopeId(source.product_scope_id ?? '')

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
          const { source: newSource } = await addKnowledgeSource(projectId, {
            type: 'codebase',
            repositoryUrl: newRepoUrl,
            repositoryBranch: selectedBranch,
            analysis_scope: analysisScope || null,
          })

          setSources(prev => prev.map(s => s.id === source.id ? newSource as unknown as KnowledgeSource : s.type === 'codebase' ? newSource as unknown as KnowledgeSource : s))
        } else if (scopeChanged) {
          await updateKnowledgeSource(projectId, source.id, { analysis_scope: analysisScope || null })
          setSources(prev => prev.map(s => s.id === source.id ? { ...s, analysis_scope: analysisScope || null } : s))
        }
      } else if (source.type === 'website' || source.type === 'docs_portal') {
        if (editUrl !== source.url) {
          await updateKnowledgeSource(projectId, source.id, { url: editUrl })
          setSources(prev => prev.map(s => s.id === source.id ? { ...s, url: editUrl } : s))
        }
      } else if (source.type === 'raw_text') {
        if (editContent !== source.content) {
          await updateKnowledgeSource(projectId, source.id, { content: editContent })
          setSources(prev => prev.map(s => s.id === source.id ? { ...s, content: editContent } : s))
        }
      }

      // Save product scope change if needed
      const newProductScopeId = editProductScopeId || null
      if (newProductScopeId !== source.product_scope_id) {
        await updateKnowledgeSource(projectId, source.id, { product_scope_id: newProductScopeId })
        setSources(prev => prev.map(s => s.id === source.id ? { ...s, product_scope_id: newProductScopeId } : s))
      }

      cancelEditing()
      onSourcesChange?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes')
    } finally {
      setIsSaving(false)
    }
  }, [projectId, selectedRepo, selectedBranch, analysisScope, editUrl, editContent, editProductScopeId, cancelEditing, onSourcesChange])

  // --- Remove / Disconnect ---

  const handleRemoveSource = useCallback(async (source: KnowledgeSource) => {
    const label = source.type === 'codebase' ? 'disconnect this codebase' : 'remove this source'
    if (!confirm(`Are you sure you want to ${label}?`)) return

    setIsSaving(true)
    setError(null)

    try {
      await deleteKnowledgeSource(projectId, source.id)

      setSources(prev => prev.filter(s => s.id !== source.id))
      if (editingSourceId === source.id) {
        cancelEditing()
      }
      onSourcesChange?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove source')
    } finally {
      setIsSaving(false)
    }
  }, [projectId, editingSourceId, cancelEditing, onSourcesChange])

  const getSourceDisplay = (source: KnowledgeSource) => {
    if (source.type === 'codebase' && source.source_code) {
      const url = source.source_code.repository_url
      const match = url.match(/github\.com\/([^/]+\/[^/]+)/)
      const repoName = match ? match[1] : url
      const branch = source.source_code.repository_branch || 'main'
      return `${repoName} (${branch})`
    }
    if (source.type === 'notion') return source.name || 'Notion page'
    if (source.url) return source.url
    if (source.content) return source.content.slice(0, 60) + (source.content.length > 60 ? '...' : '')
    if (source.type === 'uploaded_doc') return 'Uploaded document'
    return 'Unknown'
  }

  const getSourceIcon = (source: KnowledgeSource) => {
    const config = SOURCE_TYPE_CONFIG[source.type]
    return config?.icon ?? <span>📦</span>
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

        {/* Product scope selector */}
        {productScopes && productScopes.length > 0 && (
          <FormField label="Product Scope">
            <Select
              value={editProductScopeId}
              onChange={(e) => setEditProductScopeId(e.target.value)}
            >
              <option value="">Default</option>
              {productScopes.filter((a) => !a.is_default).map((scope) => (
                <option key={scope.id} value={scope.id}>
                  {scope.name}
                </option>
              ))}
            </Select>
          </FormField>
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size="md" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Alert variant="danger" className="mb-0">
          {error}
        </Alert>
      )}

      {success && (
        <Alert variant="success" className="mb-0">
          {success}
        </Alert>
      )}

      {/* Add buttons */}
      {!addingType && !editingSourceId && (
        <div className="flex flex-wrap gap-2">
          {(Object.keys(SOURCE_TYPE_CONFIG) as AddableSourceType[])
            .filter(type => type !== 'codebase' || !hasCodebaseSource)
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
          {sources
            .filter(source => {
              if (!filterProductScopeId) return true
              // null product_scope_id is equivalent to the default scope
              const defaultScope = productScopes?.find(a => a.is_default)
              if (defaultScope && filterProductScopeId === defaultScope.id) {
                return !source.product_scope_id || source.product_scope_id === defaultScope.id
              }
              return source.product_scope_id === filterProductScopeId
            })
            .map(source => {
              const scopeName = source.product_scope_id
                ? productScopes?.find(a => a.id === source.product_scope_id)?.name
                : productScopes?.find(a => a.is_default)?.name

              return editingSourceId === source.id ? (
                renderEditForm(source)
              ) : (
                <div
                  key={source.id}
                  className="flex items-center justify-between p-3 border border-[color:var(--border-subtle)] rounded-[4px] bg-[color:var(--surface)] cursor-pointer hover:border-[color:var(--accent-selected)] transition-colors"
                  onClick={() => openEditSource(source)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex items-center shrink-0">{getSourceIcon(source)}</span>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-[color:var(--foreground)] truncate">
                          {getSourceDisplay(source)}
                        </span>
                        {scopeName && (
                          <Badge variant="info" className="text-xs shrink-0">{scopeName}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[color:var(--text-tertiary)]">
                        <span className={
                          source.status === 'done' ? 'text-[color:var(--accent-success)]' :
                          source.status === 'failed' ? 'text-[color:var(--accent-danger)]' :
                          source.status === 'analyzing' ? 'text-[color:var(--accent-warning)]' :
                          ''
                        }>
                          {source.status === 'done' ? 'Analyzed' :
                           source.status === 'failed' ? 'Failed' :
                           source.status === 'analyzing' ? 'Analyzing' :
                           'Pending'}
                        </span>
                        {source.analyzed_at && (
                          <span>Last: {new Date(source.analyzed_at).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
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
            })}
        </div>
      ) : !addingType ? (
        <p className="text-sm text-[color:var(--text-tertiary)] py-4 text-center">
          No sources configured. Add a codebase, website, documentation, or custom text to enhance your agent.
        </p>
      ) : null}

      <NotionPickerDialog
        open={showNotionPicker}
        onClose={() => setShowNotionPicker(false)}
        projectId={projectId}
        onImported={() => {
          setShowNotionPicker(false)
          setSuccess('Notion pages imported successfully.')
          // Refresh sources list
          listKnowledgeSources(projectId).then(data => {
            setSources((data.sources || []) as unknown as KnowledgeSource[])
          }).catch((err) => {
            console.error('[knowledge-sources] Failed to refresh after Notion import:', err)
          })
          onSourcesChange?.()
        }}
      />
    </div>
  )
}
