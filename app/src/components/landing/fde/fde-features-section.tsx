'use client'

import { FloatingCard } from '@/components/ui/floating-card'
import { WaterReveal } from '@/components/landing/water-reveal'

const STEPS = [
  {
    id: 'requests',
    step: 1,
    title: 'Customer requests flow in',
    description:
      'Connect Slack, email, and your support widget. Every customer request is captured and categorized automatically.',
  },
  {
    id: 'triage',
    step: 2,
    title: 'AI triages and creates issues',
    description:
      'Requests are classified by type, assigned priority based on customer impact, and linked to related issues.',
  },
  {
    id: 'specs',
    step: 3,
    title: 'Specs write themselves',
    description:
      'When issues reach a threshold, detailed specifications are generated with codebase references and implementation notes.',
  },
  {
    id: 'pr',
    step: 4,
    title: 'PR-Ready Code',
    description:
      'AI generates implementation based on the spec, following your codebase patterns. Ready for your review and merge.',
  },
]

export function FDEFeaturesSection() {
  return (
    <section className="px-6 py-24 md:px-12">
      <div className="mx-auto max-w-6xl">
        <WaterReveal preset="text" parallax parallaxDepth={0.08}>
          <h2 className="text-center font-mono text-3xl font-bold text-[var(--foreground)]">
            How Your
            <span className="block bg-gradient-to-r from-[var(--accent-teal)] to-[var(--accent-selected)] bg-clip-text text-transparent">
              AI Forward Development Engineer
            </span>
            Works
          </h2>
        </WaterReveal>

        <WaterReveal preset="text" delay={0.15}>
          <p className="mx-auto mt-4 max-w-2xl text-center text-[var(--text-secondary)]">
            From customer request to pull request in four steps
          </p>
        </WaterReveal>

        {/* 4-step grid - 2x2 on desktop */}
        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <WaterReveal
              key={step.id}
              preset="card"
              staggerIndex={index}
              stagger="normal"
            >
              <div className="relative h-full">
                {/* Connecting line (hidden on mobile) */}
                {index < STEPS.length - 1 && (
                  <div
                    className="absolute right-0 top-8 hidden h-[2px] w-8 translate-x-full bg-gradient-to-r from-[var(--accent-teal)] to-transparent lg:block"
                    aria-hidden="true"
                  />
                )}

                <FloatingCard
                  floating="gentle"
                  variant="elevated"
                  respondToRipple
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
            </WaterReveal>
          ))}
        </div>
      </div>
    </section>
  )
}
