'use client'

import { FloatingCard } from '@/components/ui/floating-card'

interface ValueProp {
  id: string
  title: string
  description: string
}

const VALUE_PROPS: ValueProp[] = [
  {
    id: 'pms',
    title: 'For Product Managers',
    description:
      'Every product decision backed by customer evidence. Prioritize by revenue impact, not who yells loudest. Defend roadmap choices with data.',
  },
  {
    id: 'founders',
    title: 'For Founders',
    description:
      'Know which customer problems drive retention and expansion. Catch churn risks before they escalate. Build the roadmap that grows revenue.',
  },
  {
    id: 'engineers',
    title: 'For Product Engineers',
    description:
      'Specs come with affected accounts, revenue context, and codebase references. Build with confidence that what you ship actually matters.',
  },
]

export function PMValuePropsSection() {
  return (
    <section className="px-6 py-24 md:px-12">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center font-mono text-3xl font-bold text-[var(--foreground)]">
          Outcomes That Matter to Your Role
        </h2>

        <p className="mx-auto mt-4 max-w-2xl text-center text-[var(--text-secondary)]">
          Measurable impact across product, leadership, and engineering
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {VALUE_PROPS.map((prop, index) => (
            <FloatingCard
              key={prop.id}
              floating="gentle"
              variant="elevated"
              className="h-full p-6"
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
