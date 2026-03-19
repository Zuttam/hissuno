'use client'

import { useState, useCallback, useEffect, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ProjectInfoSection } from '@/components/projects/configuration/project-info-section'
import { Dialog, Button, Alert } from '@/components/ui'
import { fetchApiRaw } from '@/lib/api/fetch'

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

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName('')
      setDescription('')
      setError(null)
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

      const response = await fetchApiRaw('/api/projects', {
        method: 'POST',
        formData,
      })

      if (!response.ok) {
        const data = await response.json()
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

  return (
    <Dialog open={open} onClose={onClose} title="Create Project" size="xxl">
      <div className="flex flex-col gap-6">
        {error && <Alert variant="danger">{error}</Alert>}

        <ProjectInfoSection
          name={name}
          description={description}
          onNameChange={handleNameChange}
          onDescriptionChange={handleDescriptionChange}
        />

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-[color:var(--border-subtle)] pt-4">
          <Button variant="secondary" onClick={onClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCreate} loading={isCreating} disabled={isCreating}>
            Create
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
