'use client'

import { useState, useCallback, useEffect, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { EditDialog } from './edit-dialogs/edit-dialog'
import { ProjectInfoSection } from '@/components/projects/edit-dialogs/project-details-dialog'
import { LimitReachedDialog } from '@/components/billing/limit-reached-dialog'

interface LimitError {
  current: number
  limit: number
  upgradeUrl: string
}

interface CreateProjectDialogProps {
  open: boolean
  onClose: () => void
  onProjectCreated?: (project: { id: string; name: string }) => void
}

export function CreateProjectDialog({
  open,
  onClose,
  onProjectCreated,
}: CreateProjectDialogProps) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [limitError, setLimitError] = useState<LimitError | null>(null)

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName('')
      setDescription('')
      setError(null)
      setLimitError(null)
    }
  }, [open])

  const handleNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value)
  }, [])

  const handleDescriptionChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value)
  }, [])

  const handleCreate = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Project name is required')
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('name', trimmedName)
      if (description.trim()) {
        formData.append('description', description.trim())
      }
      formData.append('codebaseSource', 'none')
      formData.append('skipAnalysis', 'true')

      const response = await fetch('/api/projects', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()

        // Handle limit exceeded
        if (response.status === 429 && data.code === 'LIMIT_EXCEEDED') {
          setLimitError({
            current: data.details?.current ?? 0,
            limit: data.details?.limit ?? 0,
            upgradeUrl: data.details?.upgradeUrl ?? '/account/billing',
          })
          return
        }

        throw new Error(data.error ?? 'Failed to create project')
      }

      const { project } = await response.json()
      onProjectCreated?.(project)
      onClose()
      router.push(`/projects/${project.id}/dashboard`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
    } finally {
      setIsCreating(false)
    }
  }

  const handleCloseLimitDialog = () => {
    setLimitError(null)
    onClose()
  }

  // Show limit dialog if limit exceeded
  if (limitError) {
    return (
      <LimitReachedDialog
        open={true}
        onClose={handleCloseLimitDialog}
        current={limitError.current}
        limit={limitError.limit}
        upgradeUrl={limitError.upgradeUrl}
        dimension="analyzed_sessions"
      />
    )
  }

  return (
    <EditDialog
      open={open}
      onClose={onClose}
      onSave={handleCreate}
      title="Create Project"
      isSaving={isCreating}
      saveLabel="Create"
      error={error}
    >
      <ProjectInfoSection
        name={name}
        description={description}
        onNameChange={handleNameChange}
        onDescriptionChange={handleDescriptionChange}
      />
    </EditDialog>
  )
}
