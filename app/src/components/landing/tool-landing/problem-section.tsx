'use client'

import { motion } from 'motion/react'
import { FloatingCard } from '@/components/ui/floating-card'

const PAIN_POINTS = [
  {
    id: 'pile-up',
    title: 'Customer messages pile up',
    description:
      "You're shipping fast, but Slack DMs, emails, and feedback forms are growing faster. Important requests get buried.",
    icon: '📬',
  },
  {
    id: 'no-time',
    title: 'No time for support tooling',
    description:
      'You chose AI tools to skip boilerplate. Why spend days setting up Intercom, Zendesk, or ticketing systems?',
    icon: '⏱️',
  },
  {
    id: 'manual',
    title: 'Feedback → features is manual',
    description:
      'You know what customers want, but translating conversations into specs and issues is a time sink.',
    icon: '🔄',
  },
]

export function ProblemSection() {
  return (
    <section className="px-6 py-24 md:px-12">
      <div className="mx-auto max-w-4xl">
        <motion.h2
          className="text-center font-mono text-3xl font-bold text-[var(--foreground)]"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          Sound familiar?
        </motion.h2>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {PAIN_POINTS.map((point, index) => (
            <motion.div
              key={point.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <FloatingCard
                floating="gentle"
                variant="elevated"
                respondToRipple
                className="h-full p-6"
                style={{ '--float-delay': `${index * 0.3}s` } as React.CSSProperties}
              >
                <span className="text-3xl" role="img" aria-label={point.title}>
                  {point.icon}
                </span>
                <h3 className="mt-4 font-mono text-lg font-semibold text-[var(--foreground)]">
                  {point.title}
                </h3>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">{point.description}</p>
              </FloatingCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
