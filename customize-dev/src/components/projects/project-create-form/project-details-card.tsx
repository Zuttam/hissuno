import { Card, FormField, SectionHeader } from '@/components/ui'
import type { ProjectDetailsCardProps } from '../shared/types'

export function ProjectDetailsCard({
  name,
  description,
  onNameChange,
  onDescriptionChange,
}: ProjectDetailsCardProps) {
  return (
    <Card className="space-y-6">
      <SectionHeader
        title="Project Details"
        titleAs="h1"
        titleClassName="font-mono text-2xl font-bold uppercase tracking-tight text-[--foreground]"
        description="Name your project and optionally describe it for teammates."
      />

      <div className="grid gap-5">
        <FormField label="Project name">
          <input
            type="text"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            required
            placeholder="Acme storefront"
            className="w-full rounded-[4px] border-2 border-[--border-subtle] bg-[--background] px-3 py-2 font-mono text-sm text-[--foreground] outline-none transition focus:border-[--accent-primary] focus:ring-0"
          />
        </FormField>

        <FormField label="Description">
          <textarea
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            rows={3}
            placeholder="Short blurb so teammates know what this integration covers."
            className="w-full rounded-[4px] border-2 border-[--border-subtle] bg-[--background] px-3 py-2 font-mono text-sm text-[--foreground] outline-none transition focus:border-[--accent-primary] focus:ring-0 resize-none"
          />
        </FormField>
      </div>
    </Card>
  )
}

