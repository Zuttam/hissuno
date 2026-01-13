'use client'

import type { ChangeEvent } from 'react'
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
