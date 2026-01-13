'use client'

import { useCallback, useEffect, useState } from 'react'
import { Divider, WizardStepHeader } from '@/components/ui'
import type { StepProps } from '../types'
import { ProjectInfoSection } from './project-info-section'
import { ProjectKeysSection } from './project-keys-section'

export function ProjectDetailsStep({ context, onValidationChange, title, description }: StepProps) {
  const { formData, setFormData, mode, projectId } = context
  const [isRotating, setIsRotating] = useState(false)
  const [secretKey, setSecretKey] = useState<string | null>(null)

  // Validate on mount and when name changes
  useEffect(() => {
    const isValid = formData.name.trim().length > 0
    onValidationChange?.(isValid)
  }, [formData.name, onValidationChange])

  // Fetch secret key in edit mode
  useEffect(() => {
    if (mode === 'edit' && projectId) {
      fetch(`/api/projects/${projectId}/keys`)
        .then((res) => res.json())
        .then((data) => setSecretKey(data.secretKey))
        .catch(() => {})
    }
  }, [mode, projectId])

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, name: e.target.value }))
    },
    [setFormData]
  )

  const handleDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setFormData((prev) => ({ ...prev, description: e.target.value }))
    },
    [setFormData]
  )

  const handleRotateKey = async () => {
    if (!projectId) return

    const confirmed = window.confirm(
      'Are you sure you want to rotate the secret key? This will invalidate all existing JWT tokens.'
    )
    if (!confirmed) return

    setIsRotating(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/rotate-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyType: 'secret' }),
      })
      if (response.ok) {
        const data = await response.json()
        setSecretKey(data.project?.secret_key)
      }
    } catch (error) {
      console.error('Failed to rotate key:', error)
    } finally {
      setIsRotating(false)
    }
  }

  return (
    <div>
      <WizardStepHeader title={title} description={description} />

      <ProjectInfoSection
        name={formData.name}
        description={formData.description}
        onNameChange={handleNameChange}
        onDescriptionChange={handleDescriptionChange}
      />

      <Divider className="border-(--border)" />

      {mode === 'edit' && projectId && (
        <ProjectKeysSection
          projectId={projectId}
          secretKey={secretKey}
          onRotateKey={handleRotateKey}
          isRotating={isRotating}
        />
      )}
    </div>
  )
}
