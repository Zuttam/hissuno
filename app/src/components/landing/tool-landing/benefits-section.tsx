'use client'

import { motion } from 'motion/react'
import { FloatingCard } from '@/components/ui/floating-card'

const BENEFITS = [
  {
    id: 'zero-config',
    title: 'Zero config',
    description:
      'Works out of the box. Point it at your GitHub repo, and the AI learns your product.',
    icon: '⚡',
  },
  {
    id: 'stays-out',
    title: 'Stays out of your way',
    description:
      'No dashboards to babysit. Get Slack notifications when something needs your attention.',
    icon: '🎯',
  },
  {
    id: 'scales',
    title: 'Scales with you',
    description:
      'Start solo, add team members later. Pricing that makes sense at your stage.',
    icon: '📈',
  },
]

export function BenefitsSection() {
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
          Built for your workflow
        </motion.h2>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {BENEFITS.map((benefit, index) => (
            <motion.div
              key={benefit.id}
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
                <span className="text-3xl" role="img" aria-label={benefit.title}>
                  {benefit.icon}
                </span>
                <h3 className="mt-4 font-mono text-lg font-semibold text-[var(--foreground)]">
                  {benefit.title}
                </h3>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">{benefit.description}</p>
              </FloatingCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
