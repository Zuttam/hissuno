'use client'

import { FloatingCard } from '@/components/ui/floating-card'

const STEPS = [
  {
    id: 'triage',
    step: 1,
    title: 'Auto-triage by revenue impact',
    description:
      'Feedback is classified by urgency, revenue at risk, and pain signal strength. High-value accounts and critical issues surface first.',
  },
  {
    id: 'evidence',
    step: 2,
    title: 'Evidence from every touchpoint',
    description:
      'Slack, Gong, support, Intercom - AI extracts insights from every conversation and connects them to existing issues automatically.',
  },
  {
    id: 'specs',
    step: 3,
    title: 'Specs tied to business outcomes',
    description:
      'When evidence hits critical mass, AI generates specs with revenue context, affected accounts, and codebase references.',
  },
]

export function PMFeaturesSection() {
  return (
    <section className="px-6 py-24 md:px-12">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center font-mono text-3xl font-bold text-[var(--foreground)]">
          Product Intelligence That Pays for Itself
        </h2>

        <p className="mx-auto mt-4 max-w-2xl text-center text-[var(--text-secondary)]">
          Every capability designed to connect product decisions to business impact
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
                <div className="mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent-teal)] to-[var(--accent-selected)]">
                    <span className="font-mono text-lg font-bold text-white">
                      {step.step}
                    </span>
                  </div>
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
