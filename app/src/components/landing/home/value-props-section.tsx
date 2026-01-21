'use client'

import { FloatingCard } from '@/components/ui/floating-card'
import { WaterReveal } from '@/components/landing/water-reveal'

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
        <WaterReveal preset="text" parallax parallaxDepth={0.08}>
          <h2 className="text-center font-mono text-3xl font-bold text-[var(--foreground)]">
            Why Teams Choose Hissuno
          </h2>
        </WaterReveal>

        <WaterReveal preset="text" delay={0.15}>
          <p className="mx-auto mt-4 max-w-2xl text-center text-[var(--text-secondary)]">
            Measurable impact from day one
          </p>
        </WaterReveal>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {VALUE_PROPS.map((prop, index) => (
            <WaterReveal
              key={prop.id}
              preset="card"
              staggerIndex={index}
              stagger="normal"
            >
              <FloatingCard
                floating="gentle"
                variant="elevated"
                respondToRipple
                className="h-full p-6"
                style={{ '--float-delay': `${index * 0.2}s` } as React.CSSProperties}
              >
                <h3 className="font-mono text-xl font-semibold text-[var(--foreground)]">
                  {prop.title}
                </h3>
                <p className="mt-2 text-[var(--text-secondary)]">{prop.description}</p>
              </FloatingCard>
            </WaterReveal>
          ))}
        </div>
      </div>
    </section>
  )
}
