'use client'

import { FloatingCard } from '@/components/ui/floating-card'

const VALUE_PROPS = [
  {
    id: 'consolidation',
    title: 'Replace Multiple Tools',
    description: 'Stop juggling Intercom, Linear, Notion, and custom scripts. One platform handles it all.',
  },
  {
    id: 'speed',
    title: 'Ship Features Faster',
    description: 'From customer request to deployed code in hours, not weeks. AI handles the busywork.',
  },
  {
    id: 'satisfaction',
    title: 'Happier Customers',
    description: 'Instant responses, accurate information, and faster resolution times customers notice.',
  },
]

export function ValuePropsSection() {
  return (
    <section className="px-6 py-24 md:px-12">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center font-mono text-3xl font-bold text-[var(--foreground)]">
          Why Teams Choose Hissuno
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-[var(--text-secondary)]">
          Measurable impact from day one
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {VALUE_PROPS.map((prop, index) => (
            <FloatingCard
              key={prop.id}
              floating="gentle"
              variant="elevated"
              respondToRipple
              className="p-6"
              style={{ '--float-delay': `${index * 0.2}s` } as React.CSSProperties}
            >
              <h3 className="font-mono text-xl font-semibold text-[var(--foreground)]">
                {prop.title}
              </h3>
              <p className="mt-2 text-[var(--text-secondary)]">{prop.description}</p>
            </FloatingCard>
          ))}
        </div>
      </div>
    </section>
  )
}
