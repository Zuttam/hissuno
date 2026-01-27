'use client'

import { FloatingCard } from '@/components/ui/floating-card'
import { WaterReveal } from '@/components/landing/water-reveal'

const STEPS = [
  {
    id: 'connect',
    step: 1,
    title: 'Connect your codebase',
    description:
      'Point Hissuno at your GitHub repo. It reads your code and docs to understand your product.',
  },
  {
    id: 'embed',
    step: 2,
    title: 'Embed or invite',
    description:
      'Add the widget to your site, or invite the bot to Slack. One line of code or one click.',
  },
  {
    id: 'done',
    step: 3,
    title: "You're done",
    description:
      'Hissuno answers questions immediately. You get notified only when a human is needed.',
  },
]

export function SupportHowItWorksSection() {
  return (
    <section className="px-6 py-24 md:px-12">
      <div className="mx-auto max-w-6xl">
        <WaterReveal preset="text" parallax parallaxDepth={0.08}>
          <h2 className="text-center font-mono text-3xl font-bold text-[var(--foreground)]">
            Setup in 5 Minutes
          </h2>
        </WaterReveal>

        <WaterReveal preset="text" delay={0.15}>
          <p className="mx-auto mt-4 max-w-2xl text-center text-[var(--text-secondary)]">
            No training. No configuration. Just connect and go.
          </p>
        </WaterReveal>

        {/* 3-step horizontal flow */}
        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <WaterReveal
              key={step.id}
              preset="card"
              staggerIndex={index}
              stagger="normal"
            >
              <div className="relative h-full">
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
                  respondToRipple
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
            </WaterReveal>
          ))}
        </div>
      </div>
    </section>
  )
}
