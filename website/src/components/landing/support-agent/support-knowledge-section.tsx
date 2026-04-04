'use client'

import Image from 'next/image'
import { CheckCircle } from 'lucide-react'
import { FloatingCard } from '@/components/ui/floating-card'
import { WaterReveal } from '@/components/landing/water-reveal'

const KNOWLEDGE_POINTS = [
  {
    id: 'accurate',
    text: 'Citable answers build customer trust and reduce repeat questions',
  },
  {
    id: 'grounded',
    text: 'No hallucinations means no churn from bad support experiences',
  },
  {
    id: 'updated',
    text: 'Stays current automatically — no manual knowledge base maintenance',
  },
]

export function SupportKnowledgeSection() {
  return (
    <section className="px-6 py-24 md:px-12">
      <div className="mx-auto max-w-6xl">
        <WaterReveal preset="text" parallax parallaxDepth={0.08}>
          <h2 className="text-center font-mono text-3xl font-bold text-[var(--foreground)]">
            Every Answer Earns Customer Trust
          </h2>
        </WaterReveal>

        <WaterReveal preset="text" delay={0.15}>
          <p className="mx-auto mt-4 max-w-2xl text-center text-[var(--text-secondary)]">
            Accurate, citable answers mean customers trust self-service and your team handles fewer escalations
          </p>
        </WaterReveal>

        <div className="mt-16 grid gap-8 md:grid-cols-2">
          {/* Visual diagram */}
          <WaterReveal preset="card" staggerIndex={0}>
            <FloatingCard
              floating="gentle"
              variant="elevated"
              respondToRipple
              className="flex h-full flex-col items-center justify-center p-8"
            >
              <div className="flex items-center gap-4">
                {/* GitHub icon */}
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-xl"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--accent-teal) 15%, transparent)' }}
                >
                  <Image
                    src="/logos/github.svg"
                    alt="GitHub"
                    width={32}
                    height={32}
                    className="dark:invert"
                  />
                </div>

                <span className="text-2xl text-[var(--text-tertiary)]">+</span>

                {/* Docs icon */}
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-xl"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--accent-teal) 15%, transparent)' }}
                >
                  <Image
                    src="/file.svg"
                    alt="Documentation"
                    width={32}
                    height={32}
                    className="opacity-80 dark:invert"
                  />
                </div>
              </div>

              {/* Arrow */}
              <div className="my-6 h-12 w-0.5 bg-gradient-to-b from-[var(--accent-teal)] to-[var(--accent-selected)]" />

              {/* AI Output */}
              <div className="rounded-xl border border-[var(--accent-teal)]/30 bg-gradient-to-br from-[var(--accent-teal)]/10 to-transparent p-4">
                <p className="text-center font-mono text-sm font-medium text-[var(--foreground)]">
                  Accurate, Citable Answers
                </p>
              </div>
            </FloatingCard>
          </WaterReveal>

          {/* Benefits list */}
          <WaterReveal preset="card" staggerIndex={1}>
            <FloatingCard
              floating="gentle"
              variant="elevated"
              respondToRipple
              className="h-full p-8"
            >
              <h3 className="font-mono text-xl font-semibold text-[var(--foreground)]">
                Evidence-Grounded Support
              </h3>
              <p className="mt-2 text-[var(--text-secondary)]">
                Unlike generic chatbots, Hissuno reads your codebase and documentation. Accurate answers mean happy customers who stay.
              </p>

              <ul className="mt-6 space-y-4">
                {KNOWLEDGE_POINTS.map((point) => (
                  <li key={point.id} className="flex items-start gap-3">
                    <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-[var(--accent-teal)]" />
                    <span className="text-[var(--foreground)]">{point.text}</span>
                  </li>
                ))}
              </ul>
            </FloatingCard>
          </WaterReveal>
        </div>
      </div>
    </section>
  )
}
