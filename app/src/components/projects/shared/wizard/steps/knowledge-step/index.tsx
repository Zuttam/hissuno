'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { KnowledgeSourceType } from '@/lib/knowledge/types'
import { WizardStepHeader } from '@/components/ui'
import type { StepProps, KnowledgeSourceInput } from '../types'
import { CodebaseSource } from './codebase-source'
import { SourceTypeRow } from './source-type-row'

export function KnowledgeStep({ context, onValidationChange, title, description }: StepProps) {
  const { formData, setFormData, integrations, mode } = context

  // Knowledge step is always valid (optional)
  useEffect(() => {
    onValidationChange?.(true)
  }, [onValidationChange])

  // GitHub repository selection state
  const [repos, setRepos] = useState<
    Array<{ id: number; fullName: string; defaultBranch: string }>
  >([])
  const [branches, setBranches] = useState<string[]>([])
  const [isLoadingRepos, setIsLoadingRepos] = useState(false)
  const [isLoadingBranches, setIsLoadingBranches] = useState(false)

  // Fetch repos when GitHub is connected
  useEffect(() => {
    if (integrations.github.isConnected && context.projectId) {
      setIsLoadingRepos(true)
      fetch(`/api/integrations/github/repos?projectId=${context.projectId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.repos) {
            setRepos(data.repos)
          }
        })
        .catch(() => {})
        .finally(() => setIsLoadingRepos(false))
    }
  }, [integrations.github.isConnected, context.projectId])

  // Fetch branches when repo changes
  useEffect(() => {
    if (formData.codebase.fullName && context.projectId) {
      setIsLoadingBranches(true)
      const [owner, repo] = formData.codebase.fullName.split('/')
      fetch(
        `/api/integrations/github/repos/${owner}/${repo}/branches?projectId=${context.projectId}`
      )
        .then((res) => res.json())
        .then((data) => {
          if (data.branches) {
            setBranches(data.branches.map((b: { name: string }) => b.name))
          }
        })
        .catch(() => {})
        .finally(() => setIsLoadingBranches(false))
    }
  }, [formData.codebase.fullName, context.projectId])

  const handleRepoChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      const fullName = e.target.value
      const repo = repos.find((r) => r.fullName === fullName)
      setFormData((prev) => ({
        ...prev,
        codebase: {
          ...prev.codebase,
          source: fullName ? 'github' : 'none',
          fullName: fullName || undefined,
          repositoryUrl: fullName ? `https://github.com/${fullName}` : undefined,
          repositoryBranch: repo?.defaultBranch,
        },
      }))
    },
    [repos, setFormData]
  )

  const handleBranchChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      setFormData((prev) => ({
        ...prev,
        codebase: {
          ...prev.codebase,
          repositoryBranch: e.target.value,
        },
      }))
    },
    [setFormData]
  )

  const handleAnalysisScopeChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({
        ...prev,
        codebase: {
          ...prev.codebase,
          analysisScope: e.target.value,
        },
      }))
    },
    [setFormData]
  )

  // Knowledge source management
  const addSource = useCallback(
    (type: KnowledgeSourceType, data: Partial<KnowledgeSourceInput>) => {
      const newSource: KnowledgeSourceInput = {
        id: `${type}-${Date.now()}`,
        type,
        ...data,
      }
      setFormData((prev) => ({
        ...prev,
        knowledgeSources: [...prev.knowledgeSources, newSource],
      }))
    },
    [setFormData]
  )

  const removeSource = useCallback(
    (id: string) => {
      setFormData((prev) => ({
        ...prev,
        knowledgeSources: prev.knowledgeSources.filter((s) => s.id !== id),
      }))
    },
    [setFormData]
  )

  // Filter sources by type
  const getSourcesByType = (type: KnowledgeSourceType) =>
    formData.knowledgeSources.filter((s) => s.type === type)

  const hasCodebase = formData.codebase.source !== 'none'
  const totalSourceCount =
    (hasCodebase ? 1 : 0) + formData.knowledgeSources.length

  const descriptionWithCount = (
    <>
      {description}
      {totalSourceCount > 0 && (
        <span className="ml-1 text-[color:var(--text-primary)]">
          ({totalSourceCount} source{totalSourceCount !== 1 ? 's' : ''} configured)
        </span>
      )}
    </>
  )

  return (
    <div>
      <WizardStepHeader title={title} description={descriptionWithCount} />

      <div className="flex flex-col">
        {/* Codebase */}
        <CodebaseSource
          codebase={formData.codebase}
          github={integrations.github}
          repos={repos}
          branches={branches}
          isLoadingRepos={isLoadingRepos}
          isLoadingBranches={isLoadingBranches}
          onRepoChange={handleRepoChange}
          onBranchChange={handleBranchChange}
          onAnalysisScopeChange={handleAnalysisScopeChange}
          defaultExpanded={mode !== 'edit'}
        />

        <div className="border-b border-[color:var(--border-subtle)] w-full" />

        {/* Website */}
        <SourceTypeRow
          type="website"
          sources={getSourcesByType('website')}
          onAddSource={(data) => addSource('website', data)}
          onRemoveSource={removeSource}
        />

        <div className="border-b border-[color:var(--border-subtle)] w-full" />

        {/* Docs Portal */}
        <SourceTypeRow
          type="docs_portal"
          sources={getSourcesByType('docs_portal')}
          onAddSource={(data) => addSource('docs_portal', data)}
          onRemoveSource={removeSource}
        />

        <div className="border-b border-[color:var(--border-subtle)] w-full" />

        {/* Uploaded Doc */}
        <SourceTypeRow
          type="uploaded_doc"
          sources={getSourcesByType('uploaded_doc')}
          onAddSource={(data) => addSource('uploaded_doc', data)}
          onRemoveSource={removeSource}
        />

        <div className="border-b border-[color:var(--border-subtle)] w-full" />

        {/* Raw Text */}
        <SourceTypeRow
          type="raw_text"
          sources={getSourcesByType('raw_text')}
          onAddSource={(data) => addSource('raw_text', data)}
          onRemoveSource={removeSource}
        />
      </div>
    </div>
  )
}
