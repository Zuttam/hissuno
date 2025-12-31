'use client'

import { FormField, Input, Textarea } from '@/components/ui'

interface GeneralTabPanelProps {
  name: string
  setName: (value: string) => void
  description: string
  setDescription: (value: string) => void
}

export function GeneralTabPanel({
  name,
  setName,
  description,
  setDescription,
}: GeneralTabPanelProps) {
  return (
    <div className="flex flex-col gap-6">
      <FormField label="Name">
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </FormField>

      <FormField label="Description">
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </FormField>
    </div>
  )
}
