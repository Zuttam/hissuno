'use client'

import { FloatingCard } from '@/components/ui/floating-card'
import { WaterReveal } from '@/components/landing/water-reveal'

interface ValueProp {
  id: string
  title: string
  description: string
}

const VALUE_PROPS: ValueProp[] = [
  {
    id: 'teams',
    title: 'For Engineering Teams',
    description:
      'From request to code in hours, not weeks. Spend time on architecture and reviews, not boilerplate.',
  },
  {
    id: 'startups',
    title: 'For Startups',
    description:
      'Build what customers need without the backlog debt. Ship faster without growing the team.',
  },
  {
    id: 'founders',
    title: 'For Solo Founders',
    description:
      'Your AI engineering team, always on. Turn customer feedback into shipped features while you sleep.',
  },
]

export function FDEValuePropsSection() {
  return (
    <section className="px-6 py-24 md:px-12">
      <div className="mx-auto max-w-6xl">
        <WaterReveal preset="text" parallax parallaxDepth={0.08}>
          <h2 className="text-center font-mono text-3xl font-bold text-[var(--foreground)]">
            Ship 10x Faster
          </h2>
        </WaterReveal>

        <WaterReveal preset="text" delay={0.15}>
          <p className="mx-auto mt-4 max-w-2xl text-center text-[var(--text-secondary)]">
            Automate the path from customer request to working code
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
