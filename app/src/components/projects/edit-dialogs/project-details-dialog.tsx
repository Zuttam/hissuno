'use client'
import { useState, useCallback, type ChangeEvent } from 'react'
import { EditDialog } from './edit-dialog'
import { FormField, Input, Textarea } from '@/components/ui'



interface ProjectInfoSectionProps {
  name: string
  description: string
  onNameChange: (e: ChangeEvent<HTMLInputElement>) => void
  onDescriptionChange: (e: ChangeEvent<HTMLTextAreaElement>) => void
}

export function ProjectInfoSection({
  name,
  description,
  onNameChange,
  onDescriptionChange,
}: ProjectInfoSectionProps) {
  return (
    <div className="flex flex-col gap-4">
      <FormField label="Project name *">
        <Input
          value={name}
          onChange={onNameChange}
          placeholder="My Support Project"
          autoFocus
        />
      </FormField>

      <FormField label="Description">
        <Textarea
          value={description}
          onChange={onDescriptionChange}
          placeholder="Describe what this project is for..."
          rows={3}
        />
      </FormField>
    </div>
  )
}


interface ProjectDetailsDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  initialName: string
  initialDescription: string
  onSaved?: (updated: { name: string; description: string | null }) => void
}

export function ProjectDetailsDialog({
  open,
  onClose,
  projectId,
  initialName,
  initialDescription,
  onSaved,
}: ProjectDetailsDialogProps) {
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value)
  }, [])

  const handleDescriptionChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value)
  }, [])

  const handleSave = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Project name is required')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          description: description.trim() || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update project')
      }

      const data = await response.json()
      onSaved?.({
        name: data.project.name,
        description: data.project.description,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update project')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <EditDialog
      open={open}
      onClose={onClose}
      onSave={handleSave}
      title="Project Details"
      isSaving={isSaving}
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
