import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/class'

interface WizardStepHeaderProps {
  title: string
  description?: ReactNode
  className?: string
}

export function WizardStepHeader({
  title,
  description,
  className,
}: WizardStepHeaderProps) {
  return (
    <header className={cn('mb-6', className)}>
      <h2 className="font-mono text-xl font-bold uppercase tracking-tight text-[color:var(--foreground)] mb-2">
        {title}
      </h2>
      {description && (
        <p className="text-sm text-[color:var(--text-secondary)]">
          {description}
        </p>
      )}
    </header>
  )
}
