'use client'

import { Card } from '@/components/ui/card'
import { Heading } from '@/components/ui'

interface WorkflowCardProps {
  icon: string
  title: string
  description: string
  steps: string[]
  onClick: () => void
}

export function WorkflowCard({ icon, title, description, steps, onClick }: WorkflowCardProps) {
  return (
    <Card className="cursor-pointer transition hover:border-[color:var(--accent-selected)]">
      <div
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick()
          }
        }}
      >
        <div className="flex items-start gap-3 mb-4">
          <span className="text-2xl">{icon}</span>
          <div>
            <Heading as="h3" size="subsection">
              {title}
            </Heading>
            <p className="text-sm text-[color:var(--text-secondary)] mt-0.5">{description}</p>
          </div>
        </div>

        <div className="flex flex-col">
          {steps.map((step, index) => {
            const isLast = index === steps.length - 1
            return (
              <div key={index} className="flex items-start gap-2.5">
                {/* Circle + connector */}
                <div className="flex flex-col items-center">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-[color:var(--border-subtle)] text-[10px] font-bold text-[color:var(--text-tertiary)]">
                    {index + 1}
                  </div>
                  {!isLast && (
                    <div className="w-0.5 h-2.5 bg-[color:var(--border-subtle)]" />
                  )}
                </div>
                {/* Step name */}
                <span className="text-sm text-[color:var(--text-secondary)] pt-0.5">{step}</span>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
