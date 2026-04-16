'use client'

import { FloatingCard } from '@/components/ui/floating-card'

const STEPS = [
  {
    id: 'connect',
    step: 1,
    title: 'Connect your codebase',
    description:
      'Point Hissuno at your GitHub repo. The Hissuno Agent learns your product deeply - reducing incorrect answers and escalations.',
  },
  {
    id: 'knowledge',
    step: 2,
    title: 'Add knowledge sources',
    description:
      'Connect docs, FAQs, Notion pages. The more context, the fewer escalations and the higher your deflection rate.',
  },
  {
    id: 'deploy',
    step: 3,
    title: 'Deploy and see results',
    description:
      'Widget, Slack, email - pick your channels. Start reducing support costs and improving CSAT from day one.',
  },
]

export function SupportHowItWorksSection() {
  return (
    <section className="px-6 py-24 md:px-12">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center font-mono text-3xl font-bold text-[var(--foreground)]">
          From Setup to ROI in Minutes
        </h2>

        <p className="mx-auto mt-4 max-w-2xl text-center text-[var(--text-secondary)]">
          No training period. No manual configuration. Start reducing support costs on day one.
        </p>

        {/* 3-step horizontal flow */}
        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <div key={step.id} className="relative h-full">
              {/* Connecting line (hidden on mobile, shown between cards on desktop) */}
              {index < STEPS.length - 1 && (
                <div
                  className="absolute right-0 top-8 hidden h-[2px] w-8 translate-x-full bg-gradient-to-r from-[var(--accent-teal)] to-transparent md:block"
                  aria-hidden="true"
                />
              )}

              <FloatingCard
                floating="gentle"
                variant="elevated"
                className="h-full p-6"
                style={{ '--float-delay': `${index * 0.2}s` } as React.CSSProperties}
              >
                {/* Step number */}
                <div
                  className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent-teal)] to-[var(--accent-selected)]"
                >
                  <span className="font-mono text-lg font-bold text-white">
                    {step.step}
                  </span>
                </div>

                <h3 className="font-mono text-xl font-semibold text-[var(--foreground)]">
                  {step.title}
                </h3>
                <p className="mt-3 text-[var(--text-secondary)]">{step.description}</p>
              </FloatingCard>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
